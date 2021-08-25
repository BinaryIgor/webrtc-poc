from argparse import ArgumentParser
from os import path
import os
import subprocess
import shutil

FRONTEND = "frontend"
FAKE_CERTS = "fake-certs"

ROOT_DIR = path.split(os.getcwd())[0]

CODE_DIR = path.join(ROOT_DIR, "code")
FRONTEND_DIR = path.join(ROOT_DIR, "static", FRONTEND)
FAKE_CERTS_DIR = path.join(ROOT_DIR, "static", FAKE_CERTS)
DEPLOY_LOCAL_ROOT_DIR = path.join(ROOT_DIR, "_deploy")

EXECUTABLE_JAR_NAME = "webrtc-poc-jar-with-dependencies.jar"

HTTP_PORT = "http_port"
USE_HTTPS = "use_https"
HTTPS_CERT_PATH = "https_certs_path"
HTTPS_KEY_PATH = "https_key_path"


def cmd_args():
    parser = ArgumentParser()
    parser.add_argument(f'--{HTTP_PORT}', type=int)
    parser.add_argument(f'--{USE_HTTPS}', action="store_true",
                        help=f"""
        Whether to use https. If {HTTPS_CERT_PATH} and {HTTPS_KEY_PATH} are not specified, fake, selfsigned certificate and key will be used
    """)
    parser.add_argument(f'--{HTTPS_CERT_PATH}')
    parser.add_argument(f'--{HTTPS_KEY_PATH}')

    return vars(parser.parse_args())


def execute_script(script):
    code = subprocess.call(f"""
        set -e
        {script}
    """, shell=True)
    if code != 0:
        raise Exception(f'Fail to run, return code: {code}')


cmd = cmd_args()
print(f"Root dir: {ROOT_DIR}")

print(f"Building package, result will be available in {DEPLOY_LOCAL_ROOT_DIR}")
print("Preparing deploy dir...")

if path.exists(DEPLOY_LOCAL_ROOT_DIR):
    shutil.rmtree(DEPLOY_LOCAL_ROOT_DIR)

os.mkdir(DEPLOY_LOCAL_ROOT_DIR)

print("Building SignalServer...")
execute_script(f"""
    cd {CODE_DIR}
    mvn clean install
""")

print("Copying jar to deploy dir...")
shutil.copy(path.join(CODE_DIR, "target", EXECUTABLE_JAR_NAME),
            path.join(DEPLOY_LOCAL_ROOT_DIR, EXECUTABLE_JAR_NAME))

print()
print(f"Copying frontend from {FRONTEND_DIR}...")

shutil.copytree(FRONTEND_DIR, path.join(DEPLOY_LOCAL_ROOT_DIR, FRONTEND))

http_port = cmd.get(HTTP_PORT)
use_https = cmd.get(USE_HTTPS)

if use_https:
    print()
    print("Setting up certificates....")
    https_cert_path = cmd.get(HTTPS_CERT_PATH)
    https_key_path = cmd.get(HTTPS_KEY_PATH)
    if not https_cert_path or not https_key_path:
        print(
            f"{HTTPS_CERT_PATH} or {HTTPS_KEY_PATH} are not set, using fake certs from {FAKE_CERTS_DIR}")

        shutil.copytree(FAKE_CERTS_DIR, path.join(
            DEPLOY_LOCAL_ROOT_DIR, FAKE_CERTS))

        https_cert_path = path.join(FAKE_CERTS, "selfsigned.crt")
        https_key_path = path.join(FAKE_CERTS, "selfsigned.key")
else:
    https_cert_path = None
    https_key_path = None


print()
print("Preparing executable script...")

static_root_dir = f"WEBRTC_STATIC_ROOT_DIR={FRONTEND}"
export_http_server_port = f'export WEBRTC_HTTP_SERVER_PORT="{http_port}"' if http_port else ""
export_use_https = 'export WEBRTC_USE_HTTPS=true' if use_https else ""
export_https_cert_path = f'export WEBRTC_HTTPS_CERT_PATH="{https_cert_path}"' if https_cert_path else ""
export_https_key_path = f'export WEBRTC_HTTPS_KEY_PATH="{https_key_path}"' if https_key_path else ""

executable_script = f"""
#!bin/bash
if [ -z ${{to_package_dir}}]; then
    to_package_dir=""
else
    to_package_dir="${{to_package_dir}}/"
fi

export WEBRTC_STATIC_ROOT_DIR="${{to_package_dir}}{FRONTEND}"
{export_http_server_port}
{export_use_https}
{export_https_cert_path}
{export_https_key_path}

jar_path=${{to_package_dir}}{EXECUTABLE_JAR_NAME}

exec java -jar "${{jar_path}}"
"""

print()
print("Script prepared, copying it to target package")

with open(path.join(DEPLOY_LOCAL_ROOT_DIR, "webrtc-poc.bash"), "w") as f:
    f.write(executable_script.strip())

print()
print("Package is ready to be deployed")
