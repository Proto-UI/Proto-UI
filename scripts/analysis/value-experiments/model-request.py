#!/usr/bin/env python3
"""One stateless, tool-free participant call. Never imports or executes a response.

Only the explicit packet crosses the inference boundary. The API origin and any
credential stay in the operator's environment and are never written to evidence.
This is a bounded experimental executor, not the existing formal benchmark CLI.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request


PACKET_KEYS = {
    "schemaVersion", "packetId", "model", "system", "task", "materials",
    "outputFiles", "temperature", "maxTokens", "history", "thinking",
    "responseFormat", "timeoutSeconds",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build_request(packet):
    if not isinstance(packet, dict) or set(packet) - PACKET_KEYS:
        raise ValueError("Unknown participant packet field")
    if packet.get("schemaVersion") != 1:
        raise ValueError("Unsupported participant packet version")
    for key in ("packetId", "model", "system", "task"):
        if not isinstance(packet.get(key), str) or not packet[key]:
            raise ValueError(f"Missing participant {key}")
    if not isinstance(packet.get("materials"), list):
        raise ValueError("materials must be an explicit list")
    files = packet.get("outputFiles")
    if not isinstance(files, list) or not files or len(files) != len(set(files)):
        raise ValueError("Declare distinct output files")
    for name in files:
        if not isinstance(name, str) or not name.startswith("src/") or \
                ".." in name.split("/") or "\\" in name or \
                not name.endswith((".jsx", ".tsx", ".css")):
            raise ValueError("Output files must be bounded src JSX/TSX/CSS paths")
    messages = [{"role": "system", "content": packet["system"]}]
    material_text = []
    for item in packet["materials"]:
        if not isinstance(item, dict) or set(item) != {"label", "content"} or \
                not all(isinstance(item[k], str) for k in ("label", "content")):
            raise ValueError("Materials are literal labelled text, never paths to load")
        material_text.append(f"\n\nSupplied material: {item['label']}\n{item['content']}")
    output_instruction = (
        '\n\nReturn one JSON object with exactly a "files" object mapping these '
        f"paths to their complete UTF-8 source strings: {json.dumps(files)}. "
        'Do not return patches, tools, shell commands, or additional JSON keys. '
        'Do not fetch any material. The supplied text is your complete input.'
    )
    messages.append({"role": "user", "content": packet["task"] + "".join(material_text) + output_instruction})
    history = packet.get("history", [])
    if not isinstance(history, list) or len(history) > 8 or len(history) % 2:
        raise ValueError("At most four complete response/feedback pairs are allowed")
    for i, item in enumerate(history):
        expected_role = "assistant" if i % 2 == 0 else "user"
        if not isinstance(item, dict) or set(item) != {"role", "content"} or \
                item.get("role") != expected_role or not isinstance(item.get("content"), str):
            raise ValueError("Only literal prior responses and operator feedback are allowed")
        messages.append(dict(item))
    temperature = packet.get("temperature")
    max_tokens = packet.get("maxTokens")
    if not isinstance(temperature, (int, float)) or isinstance(temperature, bool) or not 0 <= temperature <= 2:
        raise ValueError("Declare a bounded temperature")
    if not isinstance(max_tokens, int) or isinstance(max_tokens, bool) or not 1 <= max_tokens <= 16384:
        raise ValueError("Declare a bounded output-token budget")
    if packet.get("thinking") is not False:
        raise ValueError("This frozen executor profile explicitly disables thinking")
    # No tools, previous_response_id, assistant ID, conversation ID, retrieval,
    # file attachment, evaluator, environment, or auto-executing adapter exists.
    if packet.get("responseFormat") not in (None, "json_object"):
        raise ValueError("Only the declared JSON-object response mode is allowed")
    timeout = packet.get("timeoutSeconds", 180)
    if type(timeout) is not int or not 30 <= timeout <= 600:
        raise ValueError("Declare a bounded request timeout")
    request = {
        "model": packet["model"], "messages": messages, "temperature": temperature,
        "max_tokens": max_tokens, "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    if packet.get("responseFormat"):
        request["response_format"] = {"type": packet["responseFormat"]}
    return request


def response_text(response):
    choices = response.get("choices")
    if not isinstance(choices, list) or len(choices) != 1:
        raise ValueError("Expected one model choice")
    message = choices[0].get("message", {})
    if message.get("tool_calls") or message.get("function_call"):
        raise ValueError("Tool/function responses are rejected, never dispatched")
    if choices[0].get("finish_reason") != "stop":
        raise ValueError("Truncated or nonterminal model output is retained as failure")
    text = message.get("content")
    if not isinstance(text, str):
        raise ValueError("Expected textual model output")
    return text


def parse_files(text, allowed):
    trimmed = text.strip()
    if trimmed.startswith("```json\n") and trimmed.endswith("\n```"):
        trimmed = trimmed[8:-4]
    result = json.loads(trimmed)
    if not isinstance(result, dict) or set(result) != {"files"} or \
            not isinstance(result["files"], dict) or set(result["files"]) != set(allowed):
        raise ValueError("The response must contain exactly the declared source files")
    if any(not isinstance(value, str) for value in result["files"].values()):
        raise ValueError("Source values must be text")
    if sum(len(value.encode()) for value in result["files"].values()) > 256_000:
        raise ValueError("Response source exceeds the frozen file-size bound")
    return result["files"]


def run(packet_path, output):
    packet_bytes = packet_path.read_bytes()
    packet = json.loads(packet_bytes)
    request_body = build_request(packet)
    body = json.dumps(request_body, ensure_ascii=False, separators=(",", ":")).encode()
    origin = os.environ.get("PUI_STUDY_API_BASE", "")
    url = urllib.parse.urlparse(origin)
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError("Set a credential-free API base in PUI_STUDY_API_BASE")
    output.mkdir(parents=False, exist_ok=False)
    (output / "packet.json").write_bytes(packet_bytes)
    (output / "request.json").write_bytes(body)
    started = time.monotonic()
    receipt = {
        "schemaVersion": 1, "packetId": packet["packetId"],
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "packetSha256": digest(packet_bytes), "requestSha256": digest(body),
        "executorSha256": digest(Path(__file__).read_bytes()),
        "endpoint": "operator-supplied private inference endpoint",
        "toolsProvided": [], "toolDispatchAvailable": False,
        "previousChatSessionProvided": False,
        "repairHistoryPairs": len(packet.get("history", [])) // 2,
        "thinkingRequested": False,
        "responseFormatRequested": packet.get("responseFormat"),
        "timeoutSeconds": packet.get("timeoutSeconds", 180),
        "thinkingObservation": "Requested only; actual provider accounting is retained in reportedUsage when available.",
        "seed": None,
        "seedReason": "No seed-support claim; independent stateless calls use declared sampling.",
        "status": "started", "httpStatus": None, "errorClass": None,
    }
    def save():
        (output / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    save()
    try:
        headers = {"Content-Type": "application/json"}
        if os.environ.get("PUI_STUDY_API_KEY"):
            headers["Authorization"] = "Bearer " + os.environ["PUI_STUDY_API_KEY"]
        request = urllib.request.Request(origin.rstrip("/") + "/chat/completions", data=body, headers=headers)
        with urllib.request.urlopen(request, timeout=packet.get("timeoutSeconds", 180)) as connection:
            receipt["httpStatus"] = connection.status
            response_bytes = connection.read(2_000_001)
        if len(response_bytes) > 2_000_000:
            raise ValueError("Model response exceeds the frozen response bound")
        (output / "response.json").write_bytes(response_bytes)
        receipt["responseSha256"] = digest(response_bytes)
        response = json.loads(response_bytes)
        receipt["reportedModel"] = response.get("model")
        receipt["reportedUsage"] = response.get("usage")
        receipt["systemFingerprint"] = response.get("system_fingerprint")
        text = response_text(response)
        (output / "response.txt").write_text(text)
        files = parse_files(text, packet["outputFiles"])
        (output / "submission.json").write_text(json.dumps({"files": files}, indent=2) + "\n")
        # The source remains inert JSON here. No package install, import, eval,
        # subprocess, filesystem path from the response, or test is executed.
        receipt["status"] = "submitted"
    except Exception as error:
        receipt["status"] = "failed"
        # Exceptions may contain the private endpoint or credential-bearing
        # proxy details. The public receipt intentionally records only type.
        receipt["errorClass"] = type(error).__name__
        if isinstance(error, urllib.error.HTTPError):
            receipt["httpStatus"] = error.code
    finally:
        receipt["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        receipt["elapsedSeconds"] = time.monotonic() - started
        save()
    print(json.dumps({"packetId": packet["packetId"], "status": receipt["status"], "elapsedSeconds": receipt["elapsedSeconds"]}))
    return 0 if receipt["status"] == "submitted" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packet", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    raise SystemExit(run(arguments.packet, arguments.output))
