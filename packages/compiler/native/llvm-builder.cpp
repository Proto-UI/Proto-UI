// Build LLVM objects from compiler-owned typed SSA. This process runs only while
// compiling; emitted programs contain neither this JSON reader nor an IR evaluator.
#include "llvm/IR/BasicBlock.h"
#include "llvm/IR/Constants.h"
#include "llvm/IR/Function.h"
#include "llvm/IR/IRBuilder.h"
#include "llvm/IR/LLVMContext.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/Verifier.h"
#include "llvm/MC/TargetRegistry.h"
#include "llvm/Support/JSON.h"
#include "llvm/Support/MemoryBuffer.h"
#include "llvm/Support/TargetSelect.h"
#include "llvm/Support/raw_ostream.h"
#include "llvm/Target/TargetMachine.h"
#include "llvm/Target/TargetOptions.h"
#include "llvm/TargetParser/Triple.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>
#include <limits>
#include <map>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

using Object = llvm::json::Object;
using Array = llvm::json::Array;
using Json = llvm::json::Value;

[[noreturn]] static void fail(const std::string &message) {
  throw std::runtime_error(message);
}

static const Object &object(const Json &value) {
  const auto *result = value.getAsObject();
  if (!result) fail("Expected a JSON object.");
  return *result;
}

static std::string text(const Object &obj, llvm::StringRef key) {
  auto value = obj.getString(key);
  if (!value) fail("Missing string field: " + key.str());
  return value->str();
}

static const Array &array(const Object &obj, llvm::StringRef key) {
  const auto *value = obj.getArray(key);
  if (!value) fail("Missing array field: " + key.str());
  return *value;
}

static const Json &field(const Object &obj, llvm::StringRef key) {
  const auto *value = obj.get(key);
  if (!value) fail("Missing field: " + key.str());
  return *value;
}

static uint64_t slot(const Object &obj, llvm::StringRef key = "slot") {
  auto value = obj.getInteger(key);
  // The portable ABI is wasm32; every slot address must fit without wrapping.
  if (!value || *value < 0 || *value > 0x1fffffff) {
    fail("Slot index is outside the portable 8-byte-slot address range.");
  }
  return static_cast<uint64_t>(*value);
}

static double number(const Json &value) {
  if (const auto *obj = value.getAsObject()) {
    auto kind = obj->getString("$number");
    if (kind == "nan") return std::numeric_limits<double>::quiet_NaN();
    if (kind == "+infinity") return std::numeric_limits<double>::infinity();
    if (kind == "-infinity") return -std::numeric_limits<double>::infinity();
    if (kind == "-zero") return -0.0;
    fail("Unknown IEEE-754 literal encoding.");
  }
  auto n = value.getAsNumber();
  if (!n) fail("Expected a floating-point number.");
  return *n;
}

static std::string localName(llvm::StringRef name) {
  return name.starts_with("%") ? name.drop_front().str() : name.str();
}

static std::string symbol(llvm::StringRef name) {
  std::string result;
  for (char c : name) {
    const bool admitted = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') || c == '_' || c == '.' || c == '$';
    result.push_back(admitted ? c : '_');
  }
  if (result.empty()) fail("An exported prototype must have a name.");
  if (result.front() >= '0' && result.front() <= '9') result.insert(result.begin(), '_');
  return result;
}

class ModuleBuilder {
  struct FunctionState {
    const Object *source;
    llvm::Function *function;
    std::map<std::string, llvm::BasicBlock *> blocks;
    std::map<std::string, llvm::Value *> values;
    std::vector<std::pair<llvm::PHINode *, const Object *>> phis;
  };

  llvm::LLVMContext context;
  llvm::Module module;
  std::map<std::string, llvm::Function *> functions;
  std::vector<std::unique_ptr<FunctionState>> states;

  llvm::Type *type(llvm::StringRef name) {
    if (name == "void") return llvm::Type::getVoidTy(context);
    if (name == "i1") return llvm::Type::getInt1Ty(context);
    if (name == "i32") return llvm::Type::getInt32Ty(context);
    if (name == "f64") return llvm::Type::getDoubleTy(context);
    if (name == "ptr") return llvm::PointerType::getUnqual(context);
    fail("Unknown SSA type: " + name.str());
  }

  llvm::Value *value(FunctionState &state, llvm::StringRef id) {
    auto found = state.values.find(id.str());
    if (found == state.values.end()) {
      fail(state.function->getName().str() + ": undefined or non-dominating value " + id.str());
    }
    return found->second;
  }

  llvm::BasicBlock *block(FunctionState &state, llvm::StringRef label) {
    auto found = state.blocks.find(label.str());
    if (found == state.blocks.end()) fail("Unknown basic block " + label.str());
    return found->second;
  }

  llvm::Constant *constant(llvm::StringRef name, const Json &literal) {
    if (name == "f64") return llvm::ConstantFP::get(context, llvm::APFloat(number(literal)));
    if (name == "i1") {
      auto boolean = literal.getAsBoolean();
      if (!boolean) fail("An i1 literal must be boolean.");
      return llvm::ConstantInt::get(type(name), *boolean);
    }
    if (name == "i32") {
      auto integer = literal.getAsInteger();
      if (!integer || *integer < INT32_MIN || *integer > INT32_MAX) {
        fail("An i32 literal must be a signed 32-bit integer.");
      }
      return llvm::ConstantInt::getSigned(type(name), *integer);
    }
    if (name == "ptr" && literal.kind() == Json::Null) {
      return llvm::ConstantPointerNull::get(llvm::PointerType::getUnqual(context));
    }
    fail("Unsupported constant type.");
  }

  llvm::Function *createFunction(const std::string &name, llvm::Type *returnType,
                                 llvm::ArrayRef<llvm::Type *> params, bool exported) {
    if (module.getNamedValue(name)) fail("Duplicate LLVM symbol: " + name);
    auto *signature = llvm::FunctionType::get(returnType, params, false);
    return llvm::Function::Create(signature, exported ? llvm::GlobalValue::ExternalLinkage :
      llvm::GlobalValue::InternalLinkage, name, module);
  }

  void declareFunction(const Object &source) {
    const auto name = text(source, "name");
    std::vector<llvm::Type *> params;
    for (const auto &item : array(source, "params")) {
      auto *parameterType = type(text(object(item), "type"));
      if (parameterType->isVoidTy()) fail("Function parameters cannot be void.");
      params.push_back(parameterType);
    }
    auto *fn = createFunction(name, type(text(source, "returnType")), params,
      source.getBoolean("exported").value_or(false));
    auto state = std::make_unique<FunctionState>();
    state->source = &source;
    state->function = fn;
    size_t i = 0;
    for (auto &argument : fn->args()) {
      const auto id = text(object(array(source, "params")[i++]), "id");
      argument.setName(localName(id));
      if (!state->values.emplace(id, &argument).second) fail("Duplicate parameter: " + id);
    }
    for (const auto &item : array(source, "blocks")) {
      const auto label = text(object(item), "label");
      if (state->blocks.count(label)) fail("Duplicate block: " + label);
      state->blocks.emplace(label, llvm::BasicBlock::Create(context, label, fn));
    }
    if (state->blocks.empty()) fail("A function must have an entry block.");
    functions.emplace(name, fn);
    states.push_back(std::move(state));
  }

  llvm::Value *slotPointer(llvm::IRBuilder<> &builder, llvm::Value *base, uint64_t index) {
    if (!base->getType()->isPointerTy()) fail("Slot base must be a pointer.");
    return builder.CreateGEP(builder.getInt8Ty(), base, builder.getInt64(index * 8));
  }

  llvm::Value *binary(llvm::IRBuilder<> &b, llvm::StringRef op, llvm::StringRef ty,
                      llvm::Value *left, llvm::Value *right, llvm::StringRef name) {
    if (left->getType() != type(ty) || right->getType() != type(ty)) {
      fail("Binary operands have mismatched types.");
    }
    if (ty == "f64") {
      if (op == "add") return b.CreateFAdd(left, right, name);
      if (op == "sub") return b.CreateFSub(left, right, name);
      if (op == "mul") return b.CreateFMul(left, right, name);
      if (op == "div") return b.CreateFDiv(left, right, name);
      if (op == "rem") return b.CreateFRem(left, right, name);
    } else {
      if (op == "and") return b.CreateAnd(left, right, name);
      if (op == "or") return b.CreateOr(left, right, name);
      if (op == "xor") return b.CreateXor(left, right, name);
      if (ty == "i32") {
        if (op == "add") return b.CreateAdd(left, right, name);
        if (op == "sub") return b.CreateSub(left, right, name);
        if (op == "mul") return b.CreateMul(left, right, name);
        if (op == "div") return b.CreateSDiv(left, right, name);
        if (op == "rem") return b.CreateSRem(left, right, name);
      }
    }
    fail("Invalid binary operation for " + ty.str() + ": " + op.str());
  }

  llvm::Value *compare(llvm::IRBuilder<> &b, llvm::StringRef op, llvm::StringRef ty,
                       llvm::Value *left, llvm::Value *right, llvm::StringRef name) {
    if (left->getType() != type(ty) || right->getType() != type(ty)) {
      fail("Comparison operands have mismatched types.");
    }
    if (ty == "f64") {
      if (op == "eq") return b.CreateFCmpOEQ(left, right, name);
      if (op == "ne") return b.CreateFCmpUNE(left, right, name);
      if (op == "lt") return b.CreateFCmpOLT(left, right, name);
      if (op == "le") return b.CreateFCmpOLE(left, right, name);
      if (op == "gt") return b.CreateFCmpOGT(left, right, name);
      if (op == "ge") return b.CreateFCmpOGE(left, right, name);
    } else {
      if (op == "eq") return b.CreateICmpEQ(left, right, name);
      if (op == "ne") return b.CreateICmpNE(left, right, name);
      if (ty == "i1") {
        // Boolean ordering is false=0, true=1, not signed i1 (-1).
        if (op == "lt") return b.CreateICmpULT(left, right, name);
        if (op == "le") return b.CreateICmpULE(left, right, name);
        if (op == "gt") return b.CreateICmpUGT(left, right, name);
        if (op == "ge") return b.CreateICmpUGE(left, right, name);
      } else if (ty == "i32") {
        if (op == "lt") return b.CreateICmpSLT(left, right, name);
        if (op == "le") return b.CreateICmpSLE(left, right, name);
        if (op == "gt") return b.CreateICmpSGT(left, right, name);
        if (op == "ge") return b.CreateICmpSGE(left, right, name);
      }
    }
    fail("Invalid comparison.");
  }

  llvm::Function *host(llvm::StringRef kind) {
    const auto name = ("pui_host_" + kind).str();
    if (auto *existing = module.getFunction(name)) {
      if (!existing->isDeclaration()) fail("Host operation symbol is already defined.");
      return existing;
    }
    std::vector<llvm::Type *> params{type("ptr")};
    if (kind == "emit_event" || kind == "apply_style_rule") params.push_back(type("i32"));
    else if (kind == "set_present") params.push_back(type("i1"));
    else if (kind != "request_update") fail("Unknown host operation: " + kind.str());
    return createFunction(name, type("void"), params, true);
  }

  llvm::CallInst *call(llvm::IRBuilder<> &builder, FunctionState &state,
                       llvm::Function *callee, const Array &arguments,
                       llvm::StringRef resultName) {
    if (arguments.size() != callee->arg_size()) fail("Call argument count mismatch.");
    std::vector<llvm::Value *> args;
    for (size_t i = 0; i < arguments.size(); ++i) {
      const auto &arg = object(arguments[i]);
      auto *v = value(state, text(arg, "id"));
      if (v->getType() != type(text(arg, "type")) ||
          v->getType() != callee->getFunctionType()->getParamType(i)) {
        fail("Call argument type mismatch.");
      }
      args.push_back(v);
    }
    return builder.CreateCall(callee, args, resultName);
  }

  void instruction(llvm::IRBuilder<> &b, FunctionState &state, const Object &inst) {
    const auto op = text(inst, "op");
    if (op == "const" || op == "phi") return;
    auto resultId = inst.getString("result");
    const auto name = resultId ? localName(*resultId) : std::string();
    llvm::Value *result = nullptr;
    if (op == "load_prop" || op == "load_state") {
      auto *ptr = slotPointer(b, value(state, text(inst, op == "load_prop" ?
        "propsPtr" : "statesPtr")), slot(inst));
      const auto ty = text(inst, "type");
      if (ty == "i1") {
        auto *raw = b.CreateAlignedLoad(b.getInt8Ty(), ptr, llvm::Align(8));
        result = b.CreateTrunc(raw, b.getInt1Ty(), name);
      } else result = b.CreateAlignedLoad(type(ty), ptr, llvm::Align(8), name);
    } else if (op == "store_state") {
      auto *ptr = slotPointer(b, value(state, text(inst, "statesPtr")), slot(inst));
      auto *v = value(state, text(inst, "value"));
      if (v->getType() != type(text(inst, "valueType"))) fail("Store type mismatch.");
      if (v->getType()->isIntegerTy(1)) v = b.CreateZExt(v, b.getInt8Ty());
      b.CreateAlignedStore(v, ptr, llvm::Align(8));
    } else if (op == "binop") {
      result = binary(b, text(inst, "operator"), text(inst, "type"),
        value(state, text(inst, "lhs")), value(state, text(inst, "rhs")), name);
    } else if (op == "cmp") {
      result = compare(b, text(inst, "operator"), text(inst, "operandType"),
        value(state, text(inst, "lhs")), value(state, text(inst, "rhs")), name);
    } else if (op == "not") {
      auto *v = value(state, text(inst, "operand"));
      if (!v->getType()->isIntegerTy(1)) fail("not requires i1.");
      result = b.CreateNot(v, name);
    } else if (op == "fneg") {
      auto *v = value(state, text(inst, "operand"));
      if (!v->getType()->isDoubleTy()) fail("fneg requires f64.");
      result = b.CreateFNeg(v, name);
    } else if (op == "select") {
      auto *cond = value(state, text(inst, "cond"));
      auto *yes = value(state, text(inst, "thenVal"));
      auto *no = value(state, text(inst, "elseVal"));
      if (!cond->getType()->isIntegerTy(1) || yes->getType() != type(text(inst, "type")) ||
          no->getType() != yes->getType()) fail("select operands have invalid types.");
      result = b.CreateSelect(cond, yes, no, name);
    } else if (op == "call") {
      const auto calleeName = text(inst, "callee");
      auto found = functions.find(calleeName);
      if (found == functions.end()) fail("Unknown callee " + calleeName);
      if (found->second->getReturnType() != type(text(inst, "returnType"))) {
        fail("Call return type mismatch.");
      }
      auto *called = call(b, state, found->second, array(inst, "args"), name);
      if (!called->getType()->isVoidTy()) result = called;
    } else if (op == "host_op") {
      call(b, state, host(text(inst, "kind")), array(inst, "args"), "");
    } else fail("Unknown SSA instruction " + op);
    if (result) {
      if (!resultId || !state.values.emplace(resultId->str(), result).second) {
        fail("Missing or duplicate SSA result.");
      }
    } else if (resultId) fail("A void instruction cannot define an SSA value.");
  }

  void body(FunctionState &state) {
    const auto &sourceBlocks = array(*state.source, "blocks");
    std::map<std::string, const Object *> sourceByLabel;
    for (const auto &item : sourceBlocks) {
      const auto &source = object(item);
      const auto label = text(source, "label");
      sourceByLabel.emplace(label, &source);
      llvm::IRBuilder<> b(block(state, label));
      for (const auto &itemInst : array(source, "instructions")) {
        const auto &inst = object(itemInst);
        const auto op = text(inst, "op");
        if (op != "const" && op != "phi") continue;
        const auto id = text(inst, "result");
        llvm::Value *v = nullptr;
        if (op == "const") v = constant(text(inst, "type"), field(inst, "value"));
        else {
          auto *phi = b.CreatePHI(type(text(inst, "type")), array(inst, "incoming").size(),
            localName(id));
          state.phis.emplace_back(phi, &inst);
          v = phi;
        }
        if (!state.values.emplace(id, v).second) fail("Duplicate SSA result " + id);
      }
    }

    // Reverse postorder visits a definition's dominating block before its uses.
    // Phi operands are connected after all ordinary definitions have been built.
    std::set<std::string> visited;
    std::vector<std::string> postorder;
    std::function<void(const std::string &)> visit = [&](const std::string &label) {
      if (!visited.insert(label).second) return;
      auto found = sourceByLabel.find(label);
      if (found == sourceByLabel.end()) fail("Unknown branch target " + label);
      const auto &term = object(field(*found->second, "terminator"));
      const auto op = text(term, "op");
      if (op == "br") visit(text(term, "target"));
      else if (op == "condbr") {
        visit(text(term, "thenTarget"));
        visit(text(term, "elseTarget"));
      }
      postorder.push_back(label);
    };
    visit(text(object(sourceBlocks[0]), "label"));
    std::reverse(postorder.begin(), postorder.end());
    for (const auto &item : sourceBlocks) {
      const auto label = text(object(item), "label");
      if (!visited.count(label)) postorder.push_back(label);
    }
    for (const auto &label : postorder) {
      const auto &source = *sourceByLabel.at(label);
      llvm::IRBuilder<> b(block(state, label));
      for (const auto &item : array(source, "instructions")) instruction(b, state, object(item));
      const auto &term = object(field(source, "terminator"));
      const auto op = text(term, "op");
      if (op == "br") b.CreateBr(block(state, text(term, "target")));
      else if (op == "condbr") {
        auto *cond = value(state, text(term, "cond"));
        if (!cond->getType()->isIntegerTy(1)) fail("condbr requires i1.");
        b.CreateCondBr(cond, block(state, text(term, "thenTarget")),
          block(state, text(term, "elseTarget")));
      } else if (op == "ret") {
        if (type(text(term, "type")) != state.function->getReturnType()) {
          fail("Return type differs from function type.");
        }
        if (state.function->getReturnType()->isVoidTy()) b.CreateRetVoid();
        else {
          auto *v = value(state, text(term, "value"));
          if (v->getType() != state.function->getReturnType()) fail("Return value type mismatch.");
          b.CreateRet(v);
        }
      } else if (op == "unreachable") b.CreateUnreachable();
      else fail("Unknown terminator " + op);
    }
    for (const auto &[phi, inst] : state.phis) {
      for (const auto &item : array(*inst, "incoming")) {
        const auto &incoming = object(item);
        auto *v = value(state, text(incoming, "value"));
        if (v->getType() != phi->getType()) fail("Phi operand type mismatch.");
        phi->addIncoming(v, block(state, text(incoming, "label")));
      }
    }
  }

  void constantFunction(const std::string &name, unsigned bits, uint64_t result) {
    auto *fn = createFunction(name, llvm::IntegerType::get(context, bits), {}, true);
    llvm::IRBuilder<> builder(llvm::BasicBlock::Create(context, "entry", fn));
    builder.CreateRet(llvm::ConstantInt::get(fn->getReturnType(), result));
  }

  uint64_t capacity(const Array &declarations) {
    uint64_t count = 0;
    std::set<uint64_t> indices;
    for (const auto &item : declarations) {
      auto index = slot(object(item), "index");
      if (!indices.insert(index).second) fail("Duplicate slot index.");
      count = std::max(count, index + 1);
    }
    return count;
  }

  void metadata(const Object &prototype) {
    const auto prefix = symbol(text(prototype, "name"));
    auto capText = prototype.getString("capabilityMask");
    uint64_t capabilities = 0;
    if (!capText || capText->getAsInteger(10, capabilities)) fail("Invalid capability bitmap.");
    constantFunction(prefix + "_capabilities", 64, capabilities);
    constantFunction(prefix + "_prop_count", 32, array(prototype, "props").size());
    constantFunction(prefix + "_state_count", 32, array(prototype, "states").size());
    constantFunction(prefix + "_rule_count", 32, array(prototype, "rules").size());
    const auto &declaredStates = array(prototype, "states");
    if (declaredStates.empty()) return;
    std::vector<std::string> strings;
    for (const auto &item : array(prototype, "stringTable")) {
      auto str = item.getAsString();
      if (!str) fail("String table contains a non-string value.");
      strings.push_back(str->str());
    }
    llvm::Type *params[] = {type("ptr")};
    auto *fn = createFunction(prefix + "_init_state", type("void"), params, true);
    fn->getArg(0)->setName("states");
    llvm::IRBuilder<> b(llvm::BasicBlock::Create(context, "entry", fn));
    for (const auto &item : declaredStates) {
      const auto &state = object(item);
      const auto ty = text(state, "ssaType");
      const auto &initial = field(state, "initialValue");
      llvm::Value *v = nullptr;
      if (ty == "i32") {
        auto literal = initial.getAsString();
        if (!literal) fail("String/enum initial state must be a string.");
        auto found = std::find(strings.begin(), strings.end(), literal->str());
        if (found == strings.end()) fail("Initial state is missing from the string table.");
        v = b.getInt32(static_cast<uint32_t>(std::distance(strings.begin(), found)));
      } else if (ty == "i1" || ty == "f64") v = constant(ty, initial);
      else fail("Unsupported state slot type.");
      if (ty == "i1") v = b.CreateZExt(v, b.getInt8Ty());
      b.CreateAlignedStore(v, slotPointer(b, fn->getArg(0), slot(state, "index")), llvm::Align(8));
    }
    b.CreateRetVoid();
  }

public:
  explicit ModuleBuilder(const Object &request)
    : module("proto-ui-kernels", context) {
    if (request.getInteger("protocolVersion") != 1) fail("Unsupported builder protocol.");
    const auto &source = object(field(request, "module"));
    if (source.getInteger("irVersion") != 2) fail("Unsupported Proto SSA IR version.");
    module.setSourceFileName(text(source, "sourceFile"));
    const llvm::Triple triple(text(request, "targetTriple"));
    llvm::InitializeAllTargetInfos();
    llvm::InitializeAllTargets();
    llvm::InitializeAllTargetMCs();
    std::string error;
    const auto *target = llvm::TargetRegistry::lookupTarget(triple, error);
    if (!target) fail(error);
    std::unique_ptr<llvm::TargetMachine> machine(target->createTargetMachine(
      triple, "", "", llvm::TargetOptions(), std::nullopt));
    if (!machine) fail("Cannot construct target machine.");
    module.setTargetTriple(triple);
    module.setDataLayout(machine->createDataLayout());
    for (const auto &item : array(source, "functions")) declareFunction(object(item));
    uint64_t propsSlots = 0, statesSlots = 0;
    for (const auto &item : array(source, "prototypes")) {
      const auto &prototype = object(item);
      for (const auto &fn : array(prototype, "functions")) declareFunction(object(fn));
      propsSlots = std::max(propsSlots, capacity(array(prototype, "props")));
      statesSlots = std::max(statesSlots, capacity(array(prototype, "states")));
      metadata(prototype);
    }
    constantFunction("__pui_abi_version", 32, 1);
    constantFunction("__pui_slot_bytes", 32, 8);
    constantFunction("__pui_props_slots", 32, propsSlots);
    constantFunction("__pui_states_slots", 32, statesSlots);
    for (auto &state : states) body(*state);
  }

  void print() {
    std::string diagnostics;
    llvm::raw_string_ostream errors(diagnostics);
    if (llvm::verifyModule(module, &errors)) {
      errors.flush();
      fail("LLVM rejected the constructed module: " + diagnostics);
    }
    module.print(llvm::outs(), nullptr);
  }
};

int main() {
  try {
    auto input = llvm::MemoryBuffer::getSTDIN();
    if (!input) fail("Cannot read compiler request: " + input.getError().message());
    auto parsed = llvm::json::parse((*input)->getBuffer());
    if (!parsed) fail("Invalid compiler JSON: " + llvm::toString(parsed.takeError()));
    ModuleBuilder builder(object(*parsed));
    builder.print();
    return 0;
  } catch (const std::exception &error) {
    llvm::errs() << error.what() << '\n';
    return 1;
  }
}
