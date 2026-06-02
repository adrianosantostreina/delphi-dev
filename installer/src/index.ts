#!/usr/bin/env node

import { Command } from 'commander';
import { header, step, success } from './ui';

const pkg = require('../package.json');

const program = new Command();

program
  .version(pkg.version)
  .description(pkg.description)
  .action(() => {
    header('Welcome to delphi-dev installer');
    step('This is the installer entry point');
    success('Installation completed');
  });

program.parse(process.argv);
