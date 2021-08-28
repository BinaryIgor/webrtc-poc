
import secrets
import string
from argparse import ArgumentParser
from os import path
import os
import subprocess
import shutil
import re

FRONTEND = "frontend"
FAKE_CERTS = "fake-certs"
CERTS = "certs"
WEBRTC_POC = "webrtc-poc"
COTURN = "coturn"
COTURN_CONFIG_USER_KEY = "user"

MAIN_STUN_SERVER = "stun:stun.l.google.com:19302"

ROOT_DIR = path.split(os.getcwd())[0]

CODE_DIR = path.join(ROOT_DIR, "code")
FRONTEND_DIR = path.join(ROOT_DIR, "static", FRONTEND)
FAKE_CERTS_DIR = path.join(ROOT_DIR, "static", FAKE_CERTS)
DEPLOY_LOCAL_ROOT_DIR = path.join(ROOT_DIR, "_deploy")
DEPLOY_LOCAL_WEBRTC_POC_DIR = path.join(DEPLOY_LOCAL_ROOT_DIR, WEBRTC_POC)
DEPLOY_LOCAL_COTURN_POC_DIR = path.join(DEPLOY_LOCAL_ROOT_DIR, COTURN)

EXECUTABLE_JAR_NAME = "webrtc-poc-jar-with-dependencies.jar"

SERVER_HOST = "server_host"
HTTP_PORT = "http_port"
COTURN_PORT = "coturn_port"
USE_HTTPS = "use_https"
HTTPS_CERT_PATH = "https_certs_path"
HTTPS_KEY_PATH = "https_key_path"

JS_VAR_PATTERN = re.compile("const (.*)=")
JS_CONFIG_TO_REPLACE_SIGNAL_SERVER_ENDPOINT = "signalServerEndpoint"
JS_CONFIG_TO_REPLACE_WEBRTC_CONFIGURATION = "webrtcConfiguration"
JS_REPLACE_START = "//replace_start"
JS_REPLACE_END = "//replace_end"

SECRETS_CHARACTERS = f'{string.ascii_letters}{string.digits}'
SECRETS_LENGTH = 48
PARTICIPANT_SECRET_PATTERN = re.compile("\\${(.*)}")
PARTICIPANT_ID_PATTERN = re.compile(">(.*)<")


def cmd_args():
    parser = ArgumentParser()
    parser.add_argument(f'--{SERVER_HOST}', help="Host or ip address or server, where system will be deployed. Default: localhost",
                        default="localhost")
    parser.add_argument(f'--{HTTP_PORT}')
    parser.add_argument(f'--{COTURN_PORT}', default=3478,
                        help="Port of the coturn server, which serves as both STUN and TURN server")
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


def new_coturn_credentials():
    return new_secret(), new_secret()


def replace_coturn_credentials(config_path, user, password):
    with open(config_path) as f:
        new_lines = []
        for l in f.readlines():
            if l.startswith(COTURN_CONFIG_USER_KEY):
                new_credentials = f"{COTURN_CONFIG_USER_KEY}={user}:{password}"
                new_lines.append(new_credentials)
            else:
                new_lines.append(l)

    with open(config_path, "w") as f:
        f.writelines(new_lines)


def new_participants_access():
    return {(i + 1): new_secret() for i in range(10)}


def participants_access_to_export(participants_access):
    ids_secrets = []

    for id, secret in participants_access.items():
        ids_secrets.append(f'{id}={secret}')

    return ",".join(ids_secrets)


def secure_index_html_access(html_path, participants_access):
    new_path = path.join(html_path, f'{new_secret()}.html')

    os.rename(path.join(html_path, "index.html"), new_path)

    new_lines = []
    with open(new_path) as f:
        for l in f.readlines():
            s_match = re.search(PARTICIPANT_SECRET_PATTERN, l)
            id_match = re.search(PARTICIPANT_ID_PATTERN, l)

            if s_match and id_match:
                secret_placeholder = s_match.group()
                id_value = int(id_match.group(1))

                secret_value = participants_access[id_value]

                replaced_line = l.replace(secret_placeholder, secret_value)

                new_lines.append(replaced_line)
            else:
                new_lines.append(l)

    with open(new_path, "w") as f:
        f.writelines(new_lines)


def new_secret():
    characters = list(SECRETS_CHARACTERS)
    return ''.join(secrets.choice(characters) for _ in range(SECRETS_LENGTH))


def replace_js_config(js_path, server_host, server_port, use_https, turn_user, turn_password, coturn_port):
    ws_prefix = "wss" if use_https else "ws"
    new_signal_server_endpoint = f"const signalServerEndpoint = '{ws_prefix}://{server_host}:{server_port}';"


    f""""
    TODO: fix turn and use
    {{
                urls: "turn:{server_host}:{coturn_port}",
                username: "{turn_user}",
                credential: "{turn_password}"
            }}
    """

    new_webrtc_configuration = f"""const webrtcConfiguration = {{
        iceServers: [
            {{
                urls: "{MAIN_STUN_SERVER}"
            }},
            {{
                urls: "stun:{server_host}:{coturn_port}"
            }}
        ],
    }};"""

    js_config_path = path.join(js_path, "config.js")
    new_js_config_lines = new_js_config(
        js_config_path, new_signal_server_endpoint, new_webrtc_configuration)

    with open(js_config_path, "w") as f:
        f.writelines(new_js_config_lines)


def new_js_config(js_config_path, new_signal_server_endpoint, new_webrtc_configuration):
    js_config_lines = []

    with open(js_config_path) as f:
        read_to_replace = False
        to_replace_lines = []

        for l in f.readlines():
            if not read_to_replace and l.startswith(JS_REPLACE_START):
                read_to_replace = True
            elif read_to_replace and l.startswith(JS_REPLACE_END):
                var_name = to_replace_var_nam_in_js_file(
                    js_config_path, to_replace_lines)
                if var_name == JS_CONFIG_TO_REPLACE_SIGNAL_SERVER_ENDPOINT:
                    js_config_lines.append(new_signal_server_endpoint)
                elif var_name == JS_CONFIG_TO_REPLACE_WEBRTC_CONFIGURATION:
                    js_config_lines.append(new_webrtc_configuration)
                else:
                    print(
                        f"Want to replace unknown variable {var_name}, skipping")

                to_replace_lines = []
                read_to_replace = False
            elif read_to_replace:
                to_replace_lines.append(l)
            else:
                js_config_lines.append(l)

    return js_config_lines


def to_replace_var_nam_in_js_file(js_config_path, to_replace_lines):
    to_replace_string = "\n".join(to_replace_lines)
    match = re.search(JS_VAR_PATTERN, to_replace_string)
    if not match:
        raise Exception(
            f"Failure to find js var in :{to_replace_string} str from {js_config_path} file")
    return match.group(1).strip()


cmd = cmd_args()
server_host = cmd[SERVER_HOST]
use_https = cmd.get(USE_HTTPS)
http_port = cmd.get(HTTP_PORT)
if not http_port:
    http_port = 4444 if use_https else 8888

coturn_port = cmd[COTURN_PORT]

print(f"Building package, result will be available in {DEPLOY_LOCAL_ROOT_DIR}")
print("Preparing deploy dir...")

if path.exists(DEPLOY_LOCAL_ROOT_DIR):
    shutil.rmtree(DEPLOY_LOCAL_ROOT_DIR)

os.mkdir(DEPLOY_LOCAL_ROOT_DIR)

print()
print(f"Copying {WEBRTC_POC} Dockerfiles....")
shutil.copytree(path.join(ROOT_DIR, "docker", WEBRTC_POC),
                DEPLOY_LOCAL_WEBRTC_POC_DIR)

print()
print(f"Copying {COTURN} Dockerfiles...")
shutil.copytree(path.join(ROOT_DIR, "docker", COTURN),
                DEPLOY_LOCAL_COTURN_POC_DIR)
print()
print("Replacing coturn credentials with random ones...")
coturn_user, coturn_password = new_coturn_credentials()
replace_coturn_credentials(path.join(DEPLOY_LOCAL_COTURN_POC_DIR, "coturn.conf"),
                           user=coturn_user, password=coturn_password)

print()
print(f"Building {WEBRTC_POC}...")
execute_script(f"""
    cd {CODE_DIR}
    mvn clean install
""")

print("Copying jar to deploy dir...")
shutil.copy(path.join(CODE_DIR, "target", EXECUTABLE_JAR_NAME),
            path.join(DEPLOY_LOCAL_WEBRTC_POC_DIR, EXECUTABLE_JAR_NAME))

print()
print("Generating new participants access...")
participants_access = new_participants_access()

print()
print(f"Copying frontend from {FRONTEND_DIR}...")

frontend_target = path.join(DEPLOY_LOCAL_WEBRTC_POC_DIR, FRONTEND)

shutil.copytree(FRONTEND_DIR, frontend_target)

print(f"Frontend copied, replacing js config...")
replace_js_config(js_path=frontend_target, server_host=server_host, server_port=http_port, use_https=use_https,
                  turn_user=coturn_user, turn_password=coturn_password, coturn_port=coturn_port)
print("Js config replaced")

print("Securing conference access by randomizing index.html...")
secure_index_html_access(frontend_target, participants_access)

if use_https:
    print()
    print("Setting up certificates....")
    https_cert_path = cmd.get(HTTPS_CERT_PATH)
    https_key_path = cmd.get(HTTPS_KEY_PATH)
    if not https_cert_path or not https_key_path:
        print(
            f"{HTTPS_CERT_PATH} or {HTTPS_KEY_PATH} are not set, using fake certs from {FAKE_CERTS_DIR}")

        shutil.copytree(FAKE_CERTS_DIR, path.join(
            DEPLOY_LOCAL_WEBRTC_POC_DIR, CERTS))

        https_cert_path = path.join(CERTS, "selfsigned.crt")
        https_key_path = path.join(CERTS, "selfsigned.key")
    else:
        os.mkdir(path.join(DEPLOY_LOCAL_WEBRTC_POC_DIR, CERTS))
        # TODO:support regular certificates
        pass
else:
    os.mkdir(path.join(DEPLOY_LOCAL_WEBRTC_POC_DIR, CERTS))
    https_cert_path = None
    https_key_path = None


print()
print("Preparing executable script...")

static_root_dir = f"WEBRTC_STATIC_ROOT_DIR={FRONTEND}"
export_http_server_port = f'export WEBRTC_HTTP_SERVER_PORT="{http_port}"' if http_port else ""
export_use_https = 'export WEBRTC_USE_HTTPS=true' if use_https else ""
export_https_cert_path = f'export WEBRTC_HTTPS_CERT_PATH="{https_cert_path}"' if https_cert_path else ""
export_https_key_path = f'export WEBRTC_HTTPS_KEY_PATH="{https_key_path}"' if https_key_path else ""
export_participants_access = f'export WEBRTC_PARTICIPANTS_ACCESS="{participants_access_to_export(participants_access)}"'

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
{export_participants_access}

jar_path=${{to_package_dir}}{EXECUTABLE_JAR_NAME}

exec java -jar "${{jar_path}}"
"""

print()
print("Script prepared, copying it to target package")

with open(path.join(DEPLOY_LOCAL_WEBRTC_POC_DIR, "webrtc-poc.bash"), "w") as f:
    f.write(executable_script.strip())

print()
print("Package is ready to be deployed")
