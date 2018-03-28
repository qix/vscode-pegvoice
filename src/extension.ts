'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as restify from 'restify';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as path from 'path';
import * as os from 'os';
import * as mkdirp from 'mkdirp';
import { Utf8AsciiBinaryEncoding } from 'crypto';

let server = null;

function startServer() {
    if (server) {
        stopServer();
    }
    server = restify.createServer();
    server.use(restify.plugins.bodyParser({
        mapParams: true,
    }));
        
    server.get('/state', (req, res, next) => {
        res.json({
            focused: vscode.window.state.focused,
            modes: [],
        });
        next();
    });
    server.post('/command', (req, res, next) => {
        const {command, args} = req.params;
        console.log('Executing voice command', command, args);
        vscode.commands.executeCommand(command, args || {}).then(() => {
          res.json({});
          next();
        }, (err) => {
          res.send(err);
          next();
        });
    });

    const socketPath = path.join(os.homedir(), '.pegvoice/vscode-socket');
    //mkdirp.sync(socketRoot);
    //const socketPath = tmp.tmpNameSync({
    //    dir: socketRoot,
    //});
    
    try {
        fs.unlink(socketPath, err => {
            if (err && err.code !== 'ENOENT') {
                throw err;
            }
        });

        server.listen(socketPath, function() {
            console.log('vscode-pegvoice at %s', socketPath);
        });
    } catch (err) {
        server = null;
        throw err;
    }
}
function stopServer() {
    if (server) {
        server.close();
    }
    server = null;
}

export function activate(context: vscode.ExtensionContext) {
    const stateHandler = (state: vscode.WindowState) => {
        if (state.focused) {
            try {
                startServer();
            } catch (err) {
                console.error('Failed to start server');
                console.error(err.stack);
                setTimeout(() => {
                    stateHandler(vscode.window.state);
                }, 100);
            }
        } else {
            stopServer();
        }
    };

    vscode.window.onDidChangeWindowState(stateHandler);
    stateHandler(vscode.window.state);
}

// this method is called when your extension is deactivated
export function deactivate() {
    stopServer();
}
