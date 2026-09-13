import socket
import threading
import subprocess
import sys

def get_wsl_ip():
    try:
        out = subprocess.check_output(["wsl", "-d", "podman-machine-default", "ip", "-4", "addr", "show", "eth0"], text=True)
        for line in out.splitlines():
            if "inet " in line:
                return line.strip().split()[1].split('/')[0]
    except Exception as e:
        print(f"Error resolving WSL IP: {e}", file=sys.stderr)
    return "127.0.0.1"

def forward(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try:
            src.close()
        except:
            pass
        try:
            dst.close()
        except:
            pass

def proxy_port(port, target_ip):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(("127.0.0.1", port))
        server.listen(100)
    except Exception as e:
        print(f"[Proxy] Port {port} already bound or error: {e}")
        return
    print(f"[Proxy] Active: http://localhost:{port} -> http://{target_ip}:{port}")
    while True:
        try:
            client, _ = server.accept()
            remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            remote.connect((target_ip, port))
            threading.Thread(target=forward, args=(client, remote), daemon=True).start()
            threading.Thread(target=forward, args=(remote, client), daemon=True).start()
        except Exception:
            pass

def main():
    target_ip = get_wsl_ip()
    print(f"[Proxy] Routing localhost traffic to WSL target ({target_ip})...")
    threads = []
    for port in [3000, 5000]:
        t = threading.Thread(target=proxy_port, args=(port, target_ip), daemon=True)
        t.start()
        threads.append(t)
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("[Proxy] Exiting.")

if __name__ == "__main__":
    main()
