"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.step = step;
exports.success = success;
exports.warn = warn;
exports.error = error;
exports.header = header;
exports.spinner = spinner;
exports.summary = summary;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
function step(message) {
    console.log(chalk_1.default.cyan('→'), message);
}
function success(message) {
    console.log(chalk_1.default.green('✓'), message);
}
function warn(message) {
    console.log(chalk_1.default.yellow('⚠'), message);
}
function error(message) {
    console.log(chalk_1.default.red('✗'), message);
}
function header(title) {
    console.log('');
    console.log(chalk_1.default.bold.blue('━━━ delphi-dev installer ━━━'));
    console.log(chalk_1.default.dim(title));
    console.log('');
}
function spinner(text) {
    return (0, ora_1.default)({ text, color: 'cyan' }).start();
}
function summary(items) {
    console.log('');
    console.log(chalk_1.default.bold('Installation summary:'));
    for (const item of items) {
        const icon = item.ok ? chalk_1.default.green('✓') : chalk_1.default.yellow('⚠');
        const note = item.note ? chalk_1.default.dim(` — ${item.note}`) : '';
        console.log(`  ${icon} ${item.label}${note}`);
    }
    console.log('');
}
//# sourceMappingURL=ui.js.map