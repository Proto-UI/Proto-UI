"""Adversarial information-boundary controls; no model or product outcome."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("request", Path(__file__).with_name("model-request.py"))
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


def packet():
    return {
        "schemaVersion": 1, "packetId": "leakage-control", "model": "test-model",
        "system": "Only implement the supplied task.", "task": "Make a labelled button.",
        "materials": [], "outputFiles": ["src/main.jsx", "src/style.css"],
        "temperature": 0.6, "maxTokens": 1000, "thinking": False,
    }


class Boundary(unittest.TestCase):
    def test_unreferenced_files_and_environment_never_enter_request(self):
        with tempfile.TemporaryDirectory() as directory:
            oracle = Path(directory) / "hidden-oracle.json"
            oracle.write_text("LEAK_PROBE_NOT_A_REAL_ANSWER_734")
            value = packet()
            # Even a supplied label looking like a path is inert, not read.
            value["materials"] = [{"label": str(oracle), "content": "Literal ordinary information."}]
            request = subject.build_request(value)
            encoded = json.dumps(request)
            self.assertNotIn(oracle.read_text(), encoded)
            self.assertEqual(set(request), {"model", "messages", "temperature", "max_tokens", "stream", "chat_template_kwargs"})
            self.assertEqual([item["role"] for item in request["messages"]], ["system", "user"])

    def test_tool_retrieval_and_history_channels_cannot_be_added(self):
        for key in ["tools", "tool_choice", "evaluator", "oracle", "messages", "files", "previous_response_id", "environment", "conversation_id", "attachments"]:
            value = packet()
            value[key] = {"read_file": "/hidden-oracle"}
            with self.subTest(key=key), self.assertRaises(ValueError):
                subject.build_request(value)

    def test_only_explicit_literal_repair_history_is_accepted(self):
        value = packet()
        value["history"] = [{"role": "tool", "content": "oracle answer"}, {"role": "user", "content": "continue"}]
        with self.assertRaises(ValueError): subject.build_request(value)

    def test_model_tool_requests_have_no_dispatch(self):
        for tool in ["tool_calls", "function_call"]:
            response = {"choices": [{"finish_reason": "stop", "message": {"content": "{}", tool: [{"name": "read_file"}]}}]}
            with self.subTest(tool=tool), self.assertRaises(ValueError):
                subject.response_text(response)

    def test_valid_repair_history_is_exactly_the_supplied_pair(self):
        value = packet()
        value["history"] = [
            {"role": "assistant", "content": '{"files":{"src/main.jsx":"first source"}}'},
            {"role": "user", "content": "The visible action did not activate. Repair that result."},
        ]
        result = subject.build_request(value)
        self.assertEqual(len(result["messages"]), 4)
        self.assertEqual(result["messages"][-2:], value["history"])
        self.assertEqual(result["messages"][:2], subject.build_request(packet())["messages"])

    def test_truncation_is_failed_instead_of_repaired_or_dropped(self):
        with self.assertRaises(ValueError):
            subject.response_text({"choices": [{"finish_reason": "length", "message": {"content": "partial"}}]})

    def test_path_and_configuration_injection_is_rejected(self):
        for name in ["../oracle.json", "src/../../oracle.jsx", "/tmp/payload.jsx", "src\\escape.jsx", "package.json", "vite.config.js", "src/run.sh"]:
            value = packet()
            value["outputFiles"] = [name]
            with self.subTest(name=name), self.assertRaises(ValueError): subject.build_request(value)
        with self.assertRaises(ValueError):
            subject.parse_files(json.dumps({"files": {"../../oracle": "x"}}), ["src/main.jsx"])

    def test_source_is_inert_text_and_only_declared_files_survive(self):
        source = 'import("node:fs").then(fs => fs.writeFileSync("/tmp/SHOULD_NOT_RUN", "x"))'
        result = subject.parse_files(json.dumps({"files": {"src/main.jsx": source}}), ["src/main.jsx"])
        self.assertEqual(result["src/main.jsx"], source)
        with self.assertRaises(ValueError):
            subject.parse_files(json.dumps({"files": {"src/main.jsx": source}, "command": "cat /oracle"}), ["src/main.jsx"])

    def test_json_mode_does_not_introduce_tools_or_transmit_timeout_settings(self):
        value = packet(); value.update(responseFormat='json_object', timeoutSeconds=360)
        request = subject.build_request(value)
        self.assertEqual(request['response_format'], {'type': 'json_object'})
        self.assertNotIn('timeoutSeconds', request)
        self.assertNotIn('tools', request)
        for field, invalid in [('responseFormat', {'tools': ['read_file']}), ('timeoutSeconds', 100000), ('timeoutSeconds', True)]:
            changed = dict(value); changed[field] = invalid
            with self.subTest(field=field, invalid=invalid), self.assertRaises(ValueError): subject.build_request(changed)


if __name__ == "__main__": unittest.main()
