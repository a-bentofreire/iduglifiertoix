#!/usr/bin/env node
'use strict';
// uuid: aea0e6d3-6a0d-4fef-a9f4-a64022b0299b
/**
 * @preserve Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
 * @author Alexandre Bento Freire
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice, the uuid, and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

import * as fs from 'fs';
import * as node_path from 'path';
import * as glob from 'glob2';

const
  DEFAULTINPSUFFIX = '_UG',
  DEFAULTOUTPREFIX = 'ug_',
  SCRIPTNAME = 'id-uglifier',
  VERSION = '0.1.1'; // @TIP: keep it sync with package.json version

var opts = {
  isActive: true,
  isVerbose: false,
  noOpt: false,
  inputFilePattern: '',
  outputFilePattern: '',
  outMapFileName: '',
  outMapFileIsJson: false,
  inpIdListFileName: '',
  inpIdSuffix: DEFAULTINPSUFFIX,
  outIdPrefix: DEFAULTOUTPREFIX,
  workFileList: [] as { in: string, out: string }[]
};

// ------------------------------------------------------------------------
//                               Usage
// ------------------------------------------------------------------------

function printUsage() {
  log(`Usage: ${SCRIPTNAME} [options] input-file-globs

  input-file-globs is a list of glob patterns [https://www.npmjs.com/package/glob]
  or if starts with @ it will be read from a file with same rules as -idfile
  ${SCRIPTNAME} has a safety mechanism to never overwrite the input

  Where the options are:
  -in pattern      input filename regex pattern
  -out pattern     output filename pattern
  -off             disabled the processing
  -noopt           doesn't optimizes output ids by frequency
  -m|-mapfile      name of map to generate with a list in-ids=out-ids
                   if the mapfile ends with .json it will output a json format
  -idfile          input filename with the list of ids,
                   separated by LF or CRLF to be uglified
                   lines starting with # will be discarded
  -ins|-insuffix   input id suffix. default is _UG.
                   use '.' to disactivate the default input suffix
  -outp|-outprefix output id prefix. default is ug_
  -v               verbose
  -version         version

  e.g.
  ${SCRIPTNAME} -in in-folder -out out-folder -m tests/outmap.txt tests/in-folder/**

      Reads tests/in-folder/**, processes the ids,
      outputs the to tests/out-folder/**
      and writes the id map to tests/outmap.txt

  ${SCRIPTNAME} -noopt -in in-folder -out out-folder -ins . -ous ug__ -idfile tests/idlist.txt -m tests/outmap.json tests/in-folder/**

    Same as above but desactivates order id by frequency,
    the out map is in .json format,
    loads an idlist file to uglify,
    the output prefix is ug__ instead of ug_,
    and deactivates the default input prefix

  ${SCRIPTNAME} -noopt -in '\\.(\\w+)$' -out '.out.$1' tests/in-folder/**

    Writes the output to the same folder but adds  .out to the extension
    input is tests/in-folder/**
    output will be tests/in-folder/test-input.out.js
`);

}
// ------------------------------------------------------------------------
//                               I/O tools
// ------------------------------------------------------------------------

function loadText(fileName: string, encoding?: string): string {
  return fs.readFileSync(fileName, { encoding: encoding || 'utf-8' });
}

function saveText(fileName: string, data: string): void {
  fs.writeFileSync(fileName, data);
}

function saveJson(fileName: string, obj, format?): void {
  fs.writeFileSync(fileName, format === false ? JSON.stringify(obj) :
    JSON.stringify(obj, null, format !== undefined ? format : 2));
}

function loadTextLines(fileName: string, encoding?: string): string[] {
  if (!fs.existsSync(fileName)) {
    let msg = `${fileName} doesn't exists!`;
    log(msg, true);
    throw msg;
  }

  let lines = loadText(fileName).split('\n');
  let outLines = [];
  lines.forEach(line => {
    line = line.trim();
    if (line && line[0] !== '#') {
      outLines.push(line);
    }
  });

  return outLines;
}

function mkdirp(dir: string) {
  if (dir !== '' && dir !== '/' && !fs.existsSync(dir)) {
    mkdirp(node_path.dirname(dir));
    fs.mkdirSync(dir);
  }
}

function ensureDirExists(fileName: string): void {
  let dir = node_path.dirname(fileName);
  mkdirp(dir);
}

// ------------------------------------------------------------------------
//                               Logging
// ------------------------------------------------------------------------

function log(msg, isError = false) {
  if (!isError) console.log(msg);
  else console.log(`ERROR: ${msg}`);
}

// ------------------------------------------------------------------------
//                               processFiles
// ------------------------------------------------------------------------

function processFiles(): void {
  let idsByFreq: { [key: string]: number } = {};

  // excludes words starting with digits
  let inRegExList = [];

  if (opts.inpIdSuffix !== '.')
    inRegExList.push(new RegExp('\\b(_*[A-Z]\\w+' + opts.inpIdSuffix + ')\\b', 'gi'));
  else
    if (opts.isVerbose) log(`No default Id Suffix`);

  // loads Id List
  if (opts.inpIdListFileName !== '') {
    if (opts.isVerbose) log(`Id fileName: ${opts.inpIdListFileName}`);
    loadTextLines(opts.inpIdListFileName).forEach(id => {
      inRegExList.push(new RegExp(`\\b(${id})\\b`, 'g'));
    });
  }

  // 1-step: Scan all the input files for word frequency
  opts.workFileList.forEach(file => {
    inRegExList.forEach(inRegEx => {
      let mat = loadText(file.in).match(inRegEx);
      if (mat) {
        mat.forEach(id => idsByFreq[id] = (idsByFreq[id] || 0) + 1);
      }
    });
  });

  // sorts ids by frequency
  let idsAndFreq = Object.keys(idsByFreq).map(id => [id, idsByFreq[id]] as [string, number]);
  if (!opts.noOpt) {
    if (opts.isVerbose) log(`Sorting Ids by Frequency`);
    idsAndFreq.sort((a, b) => b[1] - a[1]);
  }

  let mapData: string[] = [];
  let idsInpToOut: { [inpId: string]: string } = {};
  // builds output ids and
  idsAndFreq.forEach((idAndFreq, index) => {
    let id = idAndFreq[0];
    idsInpToOut[id] = opts.outIdPrefix + index;
    if (!opts.outMapFileIsJson)
      mapData.push(opts.outIdPrefix + index + '=' + id);
  });

  // saves Map File
  if (opts.outMapFileName) {
    ensureDirExists(opts.outMapFileName);
    if (!opts.outMapFileIsJson) {
      if (opts.isVerbose) log(`Saving mapfile in text format: ${opts.outMapFileName}`);
      saveText(opts.outMapFileName, mapData.join('\n'));
    }
    else {
      if (opts.isVerbose) log(`Saving mapfile in JSON format: ${opts.outMapFileName}`);
      saveJson(opts.outMapFileName, idsInpToOut);
    }
  }

  // 2-step: Builds output tree
  opts.workFileList.forEach(file => {
    let lines = loadText(file.in);
    if (opts.isActive) {
      inRegExList.forEach(inRegEx => {
        lines = lines.replace(inRegEx, (match: string, p1: string) => idsInpToOut[p1]);
      });
    }
    ensureDirExists(file.out);
    saveText(file.out, lines);
  });
}

// ------------------------------------------------------------------------
//                               parseCommandline
// ------------------------------------------------------------------------

function parseCommandline() {

  let argv = process.argv;
  let curArg: string;
  let inpFileGlobs: string[] = [];

  function peekArg(toRemove: boolean): string {
    if (argv.length > 0) {
      curArg = argv[0];
      if (toRemove) {
        argv.shift();
      }
      return curArg;
    } else {
      return '';
    }
  }

  argv.splice(0, 2);
  while (argv.length > 0) {
    if (opts.isVerbose) log(`option: ${peekArg(false)}`);
    switch (peekArg(true)) {

      case '-off':
        opts.isActive = false;
        log(`Disactivated ${SCRIPTNAME}`);
        break;

      case '-noopt':
        opts.noOpt = true;
        break;

      case '-v':
        opts.isVerbose = true;
        break;

      case '-version':
        log(`${SCRIPTNAME} ${VERSION}`);
        return false; // stops all processing


      case '-in':
        opts.inputFilePattern = peekArg(true);
        break;

      case '-out':
        opts.outputFilePattern = peekArg(true);
        break;

      case '-mapfile':
      case '-m':
        opts.outMapFileName = peekArg(true);
        opts.outMapFileIsJson = opts.outMapFileName.endsWith('.json');
        break;

      case '-insuffix':
      case '-ins':
        opts.inpIdSuffix = peekArg(true);
        break;

      case '-outprefix':
      case '-outp':
        opts.outIdPrefix = peekArg(true);
        break;

      case '-idfile':
        opts.inpIdListFileName = peekArg(true);
        break;

      default:
        do {
          log(`curArg: ${curArg}`);
          if (curArg[0] === '@') {
            let globFileName = curArg.substr(1);
            log(`globFileName ${globFileName}`);
            inpFileGlobs = inpFileGlobs.concat(loadTextLines(globFileName));
            log(`inpFileGlobs: ${inpFileGlobs}`);
          } else {
            inpFileGlobs.push(curArg);
          }
        } while (peekArg(true));
    }
  }
  if (!opts.inputFilePattern || !opts.outputFilePattern) {
    printUsage();
    return false;
  }
  log(`inpFileGlobs: ${inpFileGlobs}`);
  let re = new RegExp(opts.inputFilePattern);

  // scans all the file names using glob
  if (opts.isVerbose) log(`input file globs: ${inpFileGlobs}`);
  let endCount = 0;
  inpFileGlobs.forEach((inFileGlob, globIndex) => {

    let gb = new glob.Glob(inFileGlob, {
      nosort: true,
      // nodir: true
    });

    gb.on('match', (inFileName: string) => {
      if (fs.lstatSync(inFileName).isFile()) {
        if (opts.isVerbose) log(`input fileName: ${inFileName}`);
        let outFileName = inFileName.replace(re, opts.outputFilePattern);
        if (inFileGlob !== outFileName) {
          if (opts.isVerbose) log(`output fileName: ${outFileName}`);
          opts.workFileList.push({ in: inFileName, out: outFileName });
        }
        else {
          log(`${inFileName} has the same output fileName`, true);
        }
      } 
    });
    gb.on('end', () => {
      endCount++; // since glob might be racing, this garanties all the glob have finished
      if (endCount === inpFileGlobs.length) {
        log(opts.workFileList);
        if (opts.isVerbose) log(`all globs have finished`);
        processFiles();
      }
    });
  });
  return true;
}

// ------------------------------------------------------------------------
//                               Main body
// ------------------------------------------------------------------------

// since glob is async, the processFiles() is called by glob.on('end')
parseCommandline();

