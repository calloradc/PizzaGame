"""Serve the release at / and /pizza/ to verify subdirectory deployments."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


class ReleaseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="dist", **kwargs)

    def log_message(self, *args):
        pass

    def translate_path(self, path):
        if urlsplit(path).path.startswith("/pizza/"):
            path = path[len("/pizza"):]
        return super().translate_path(path)


ThreadingHTTPServer(("127.0.0.1", 4173), ReleaseHandler).serve_forever()
