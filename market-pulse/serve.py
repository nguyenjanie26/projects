import os, http.server, socketserver
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 5173
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({'.js':'application/javascript','.css':'text/css'})
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.serve_forever()
