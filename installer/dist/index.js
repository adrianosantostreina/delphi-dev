#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const ui_1 = require("./ui");
const pkg = require('../package.json');
const program = new commander_1.Command();
program
    .version(pkg.version)
    .description(pkg.description)
    .action(() => {
    (0, ui_1.header)('Welcome to delphi-dev installer');
    (0, ui_1.step)('This is the installer entry point');
    (0, ui_1.success)('Installation completed');
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map