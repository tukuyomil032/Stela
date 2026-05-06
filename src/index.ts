#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('stela')
  .version('0.0.0')
  .description(
    'A TypeScript CLI that lets you view starred repositories, unstar them, and search for repositories by language or genre to star new ones',
  );
program.parse(process.argv);
