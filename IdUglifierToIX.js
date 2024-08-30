#!/usr/bin/env node
"use strict";
import * as fs from "fs";
import * as node_path from "path";
import { glob } from "glob";
import { minimatch } from "minimatch";
const DEFAULT_INPUT_SUFFIX = "_UG", DEFAULT_OUTPUT_PREFIX = "ug_", TOOL_NAME = "iduglifiertoix", VERSION = "1.0.0";
let opts = {
  isActive: true,
  isVerbose: false,
  noOpt: false,
  inputFilePattern: "",
  outputFilePattern: "",
  outMapFileName: "",
  outMapFileIsJson: false,
  inpIdListFileName: "",
  inpIdSuffix: DEFAULT_INPUT_SUFFIX,
  outIdPrefix: DEFAULT_OUTPUT_PREFIX,
  workFileList: []
};
function printUsage() {
  log(`Usage: ${TOOL_NAME} [options] input-file-globs

  input-file-globs is a list of glob patterns [https://www.npmjs.com/package/glob]
  or if starts with @ it will be read from a file with same rules as -id-file
  ${TOOL_NAME} has a safety mechanism to never overwrite the input

  Where the options are:
  -in pattern      input filename regex pattern
  -out pattern     output filename pattern
  -e exclude-files this is a glob pattern [https://github.com/isaacs/minimatch]
                   that excludes files from being processed.
                   Use multiple times to exclude multiple patterns or
                   start with @ to retrieve from a file
  -off             disabled the processing
  -no-opt          doesn't optimizes output ids by frequency
  -m|-map-file     name of map to generate with a list in-ids=out-ids
                   if the mapfile ends with .json it will output a json format
  -id-file         input filename with the list of ids,
                   separated by LF or CRLF to be uglified
                   lines starting with # will be discarded
  -ins|-in-suffix  input id suffix. default is _UG.
                   use '.' to disactivate the default input suffix
  -outp|-out-prefix output id prefix. default is ug_
  -v               verbose
  -version         version

  e.g.
  ${TOOL_NAME} -in in-folder -out out-folder -m test/outmap.txt test/in-folder/**

      Reads test/in-folder/**, processes the ids,
      outputs the to test/out-folder/**
      and writes the id map to test/outmap.txt

  ${TOOL_NAME} -no-opt -in in-folder -out out-folder -ins . -ous ug__ -id-file test/idlist.txt -m test/outmap.json -e '*.css' test/in-folder/**

    Same as above but deactivates order id by frequency,
    the out map is in .json format,
    loads an idlist file to uglify,
    the output prefix is ug__ instead of ug_,
    excludes all the '.css' files
    and deactivates the default input prefix

  ${TOOL_NAME} -no-opt -in '\\.(\\w+)$' -out '.out.$1' test/in-folder/**

    Writes the output to the same folder but adds  .out to the extension
    input is test/in-folder/**
    output will be test/in-folder/test-input.out.js
`);
}
function loadText(fileName, encoding) {
  return fs.readFileSync(fileName, { encoding: encoding || "utf-8" });
}
function saveText(fileName, data) {
  fs.writeFileSync(fileName, data);
}
function saveJson(fileName, obj, format) {
  fs.writeFileSync(fileName, format === false ? JSON.stringify(obj) : JSON.stringify(obj, null, format !== void 0 ? format : 2));
}
function loadTextLines(fileName, encoding) {
  if (!fs.existsSync(fileName)) {
    let msg = `${fileName} doesn't exists!`;
    log(msg, true);
    throw msg;
  }
  let lines = loadText(fileName).split("\n");
  let outLines = [];
  lines.forEach((line) => {
    line = line.trim();
    if (line && line[0] !== "#") {
      outLines.push(line);
    }
  });
  return outLines;
}
function mkdirp(dir) {
  if (dir !== "" && dir !== "/" && !fs.existsSync(dir)) {
    mkdirp(node_path.dirname(dir));
    fs.mkdirSync(dir);
  }
}
function ensureDirExists(fileName) {
  let dir = node_path.dirname(fileName);
  mkdirp(dir);
}
function log(msg, isError = false) {
  if (!isError) console.log(msg);
  else console.log(`ERROR: ${msg}`);
}
function processFiles() {
  let idsByFreq = {};
  let inRegExList = [];
  if (opts.inpIdSuffix !== ".")
    inRegExList.push(new RegExp("\\b(_*[A-Z]\\w+" + opts.inpIdSuffix + ")\\b", "gi"));
  else if (opts.isVerbose) log(`No default Id Suffix`);
  if (opts.inpIdListFileName !== "") {
    if (opts.isVerbose) log(`Id fileName: ${opts.inpIdListFileName}`);
    loadTextLines(opts.inpIdListFileName).forEach((id) => {
      inRegExList.push(new RegExp(`\\b(${id})\\b`, "g"));
    });
  }
  opts.workFileList.forEach((file) => {
    inRegExList.forEach((inRegEx) => {
      let mat = loadText(file.in).match(inRegEx);
      if (mat) {
        mat.forEach((id) => idsByFreq[id] = (idsByFreq[id] || 0) + 1);
      }
    });
  });
  let idsAndFreq = Object.keys(idsByFreq).map((id) => [id, idsByFreq[id]]);
  if (!opts.noOpt) {
    if (opts.isVerbose) log(`Sorting Ids by Frequency`);
    idsAndFreq.sort((a, b) => b[1] - a[1]);
  }
  let mapData = [];
  let idsInpToOut = {};
  idsAndFreq.forEach((idAndFreq, index) => {
    let id = idAndFreq[0];
    idsInpToOut[id] = opts.outIdPrefix + index;
    if (!opts.outMapFileIsJson)
      mapData.push(opts.outIdPrefix + index + "=" + id);
  });
  if (opts.outMapFileName) {
    ensureDirExists(opts.outMapFileName);
    if (!opts.outMapFileIsJson) {
      if (opts.isVerbose) log(`Saving mapfile in text format: ${opts.outMapFileName}`);
      saveText(opts.outMapFileName, mapData.join("\n"));
    } else {
      if (opts.isVerbose) log(`Saving mapfile in JSON format: ${opts.outMapFileName}`);
      saveJson(opts.outMapFileName, idsInpToOut);
    }
  }
  opts.workFileList.forEach((file) => {
    let lines = loadText(file.in);
    if (opts.isActive) {
      inRegExList.forEach((inRegEx) => {
        lines = lines.replace(inRegEx, (match, p1) => idsInpToOut[p1]);
      });
    }
    ensureDirExists(file.out);
    saveText(file.out, lines);
  });
}
async function parseCommandLine() {
  let argv = process.argv;
  let curArg;
  let inpFileGlobs = [];
  let exclFileGlobs = [];
  let exclMiniMatches = [];
  function peekArg(toRemove) {
    if (argv.length > 0) {
      curArg = argv[0];
      if (toRemove) {
        argv.shift();
      }
      return curArg;
    } else {
      return "";
    }
  }
  argv.splice(0, 2);
  while (argv.length > 0) {
    if (opts.isVerbose) log(`option: ${peekArg(false)}`);
    switch (peekArg(true)) {
      case "-off":
        opts.isActive = false;
        log(`Disactivated ${TOOL_NAME}`);
        break;
      case "-no-opt":
        opts.noOpt = true;
        break;
      case "-v":
        opts.isVerbose = true;
        break;
      case "-version":
        log(`${TOOL_NAME} ${VERSION}`);
        return false;
      case "-in":
        opts.inputFilePattern = peekArg(true);
        break;
      case "-out":
        opts.outputFilePattern = peekArg(true);
        break;
      case "-map-file":
      case "-m":
        opts.outMapFileName = peekArg(true);
        opts.outMapFileIsJson = opts.outMapFileName.endsWith(".json");
        break;
      case "-in-suffix":
      case "-ins":
        opts.inpIdSuffix = peekArg(true);
        break;
      case "-out-prefix":
      case "-outp":
        opts.outIdPrefix = peekArg(true);
        break;
      case "-id-file":
        opts.inpIdListFileName = peekArg(true);
        break;
      case "-e":
        let exclFileGlob = peekArg(true);
        if (exclFileGlob[0] === "@") {
          let globExclFileName = exclFileGlob.substring(1);
          exclFileGlobs = inpFileGlobs.concat(loadTextLines(globExclFileName));
        } else {
          exclFileGlobs.push(exclFileGlob);
        }
        break;
      default:
        do {
          if (curArg[0] === "@") {
            let globFileName = curArg.substring(1);
            inpFileGlobs = inpFileGlobs.concat(loadTextLines(globFileName));
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
  let re = new RegExp(opts.inputFilePattern);
  exclMiniMatches = exclFileGlobs.map((exclFileGlob) => new minimatch.Minimatch(exclFileGlob, { matchBase: true }));
  if (opts.isVerbose) log(`input file globs: ${inpFileGlobs}`);
  let endCount = 0;
  inpFileGlobs.forEach(async (inFileGlob) => {
    const gb = await glob(inFileGlob);
    gb.forEach((inFileName) => {
      if (fs.lstatSync(inFileName).isFile()) {
        if (exclMiniMatches.some((exclMiniMatch) => exclMiniMatch.match(inFileName))) {
          return;
        }
        if (opts.isVerbose) log(`input fileName: ${inFileName}`);
        let outFileName = inFileName.replace(re, opts.outputFilePattern);
        if (inFileGlob !== outFileName) {
          if (opts.isVerbose) log(`output fileName: ${outFileName}`);
          opts.workFileList.push({ in: inFileName, out: outFileName });
        } else {
          log(`${inFileName} has the same output fileName`, true);
        }
      }
    });
    endCount++;
    if (endCount === inpFileGlobs.length) {
      if (opts.isVerbose) log(`all globs have finished`);
      processFiles();
    }
  });
  return true;
}
parseCommandLine();
