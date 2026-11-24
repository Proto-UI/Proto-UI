import subprocess,json,pathlib,time,os
p=pathlib.Path('/var/tmp/proto-ui-s7-transfer-456f/current-main-delivery')
s=time.monotonic()
with (p/"install.log").open("w") as f:
 r=subprocess.run(["corepack","pnpm@10.32.1","install","--offline","--frozen-lockfile"],cwd='/var/tmp/proto-ui-s7-delivery-456f',stdout=f,stderr=subprocess.STDOUT)
(p/"install-terminal.json").write_text(json.dumps({"exitCode":r.returncode,"elapsedMs":round((time.monotonic()-s)*1000)},indent=2)+"\n")
