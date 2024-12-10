import React, { useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "../Style/TerminalStyle.css";

function WebContaine() {
  const iframeRef = useRef(null);
  const textareaRef = useRef(null);
  const terminalRef = useRef(null);
  const [webcontainerInstance, setWebcontainerInstance] = useState(null);

  const files = {
    "index.js": {
      file: {
        contents: `
import express from 'express';
 
const app = express();
const port = 3111;
 
app.get('/', (req, res) => {
  res.send('Welcome to a WebContainers app! 🥳');
});
 
app.listen(port, () => {
console.log(\`App is live at http://localhost:\${port}\`);
});
`,
      },
    },
    "package.json": {
      file: {
        contents: `{
  "name": "example-app",
  "type": "module",
  "dependencies": {
    "express": "latest",
    "nodemon": "latest"
  },
  "scripts": {
    "start": "nodemon index.js"
  }
}`,
      },
    },
  };

  useEffect(() => {
    const initializeWebContainer = async () => {
      const webContainer = await WebContainer.boot();
      setWebcontainerInstance(webContainer);

      // Mount files
      await webContainer.mount(files);

      // Install dependencies
      const installProcess = await webContainer.spawn("npm", ["install"]);
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log(data);
          },
        })
      );
      await installProcess.exit;

      // Start the dev server
      webContainer.on("server-ready", (port, url) => {
        if (iframeRef.current) iframeRef.current.src = url;
      });

      await webContainer.spawn("npm", ["run", "start"]);

      // Initialize Terminal
      const fitAddon = new FitAddon();
      const terminal = new Terminal({
        convertEol: true,
        theme: { background: "#1e1e1e", foreground: "#ffffff" },
      });
      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current);
      fitAddon.fit();

      // Start Shell
      const shellProcess = await startShell(webContainer, terminal);

      // Handle resizing
      window.addEventListener("resize", () => {
        fitAddon.fit();
        shellProcess.resize({ cols: terminal.cols, rows: terminal.rows });
      });

      // Sync textarea content
      if (textareaRef.current) {
        textareaRef.current.value = files["index.js"].file.contents;
        textareaRef.current.addEventListener("input", (e) => {
          writeIndexJS(webContainer, e.target.value);
        });
      }
    };

    initializeWebContainer();

    return () => {
      webcontainerInstance?.teardown();
    };
  }, []);

  const startShell = async (webContainer, terminal) => {
    const shellProcess = await webContainer.spawn("jsh", {
      terminal: { cols: terminal.cols, rows: terminal.rows },
    });

    shellProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );

    const input = shellProcess.input.getWriter();
    terminal.onData((data) => input.write(data));

    return shellProcess;
  };

  const writeIndexJS = async (webContainer, content) => {
    await webContainer.fs.writeFile("/index.js", content);
  };

  return (
    <div id="app">
      <div className="container">
        <div className="editor">
          <textarea ref={textareaRef} className="code-editor"></textarea>
        </div>
        <div className="preview">
          <iframe
            ref={iframeRef}
            title="WebContainer App"
            src="loading.html"
          ></iframe>
        </div>
      </div>
      <div className="terminal" ref={terminalRef}></div>
    </div>
  );
}

export default WebContaine;
