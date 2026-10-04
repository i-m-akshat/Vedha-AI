import socket
import threading
import subprocess
import time
import sys

_cached_ip = None
_last_check = 0

def get_wsl_ip():
    global _cached_ip, _last_check
    now = time.time()
    if _cached_ip and (now - _last_check < 10):
        return _cached_ip
    try:
        out = subprocess.check_output(
            ["wsl", "-d", "podman-machine-default", "ip", "-4", "addr", "show", "eth0"],
            text=True,
            timeout=3
        )
        for line in out.splitlines():
            if "inet " in line:
                ip = line.strip().split()[1].split('/')[0]
                _cached_ip = ip
                _last_check = now
                return ip
    except Exception as e:
        if not _cached_ip:
            _cached_ip = "127.0.0.1"
    return _cached_ip

def forward(src, dst, done_event):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass
        done_event.set()

def handle_connection(client, port):
    target_ip = get_wsl_ip()
    remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        remote.connect((target_ip, port))
        c2r_done = threading.Event()
        r2c_done = threading.Event()

        t1 = threading.Thread(target=forward, args=(client, remote, c2r_done), daemon=True)
        t2 = threading.Thread(target=forward, args=(remote, client, r2c_done), daemon=True)
        t1.start()
        t2.start()

        r2c_done.wait()
    except Exception:
        pass
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            remote.close()
        except Exception:
            pass

def proxy_port(port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(("127.0.0.1", port))
        server.listen(100)
    except Exception as e:
        print(f"[Proxy] Port {port} bind error: {e}")
        return
    print(f"[Proxy] Active: http://localhost:{port} -> WSL:{port}")
    while True:
        try:
            client, _ = server.accept()
            threading.Thread(target=handle_connection, args=(client, port), daemon=True).start()
        except Exception:
            pass

def main():
    initial_ip = get_wsl_ip()
    print(f"[Proxy] Initialized. Current WSL IP: {initial_ip}")
    threads = []
    for port in [3000, 5000, 6379, 4222]:
        t = threading.Thread(target=proxy_port, args=(port,), daemon=True)
        t.start()
        threads.append(t)
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("[Proxy] Exiting.")

if __name__ == "__main__":
    main()
