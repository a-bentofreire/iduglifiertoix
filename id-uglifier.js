#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ------------------------------------------------------------------------
// Copyright (c) 2018-2024 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License.
// ------------------------------------------------------------------------
var fs = require("fs");
var node_path = require("path");
var glob = require("glob2");
var minimatch = require("minimatch");
var DEFAULTINPSUFFIX = '_UG', DEFAULTOUTPREFIX = 'ug_', SCRIPTNAME = 'id-uglifier', VERSION = '0.2.5'; // @TIP: keep it sync with package.json version
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
    workFileList: []
};
// ------------------------------------------------------------------------
//                               Usage
// ------------------------------------------------------------------------
function printUsage() {
    log("Usage: " + SCRIPTNAME + " [options] input-file-globs\n\n  input-file-globs is a list of glob patterns [https://www.npmjs.com/package/glob]\n  or if starts with @ it will be read from a file with same rules as -idfile\n  " + SCRIPTNAME + " has a safety mechanism to never overwrite the input\n\n  Where the options are:\n  -in pattern      input filename regex pattern\n  -out pattern     output filename pattern\n  -e exclude-files this is a glob pattern [https://github.com/isaacs/minimatch]\n                   that excludes files from being processed.\n                   Use multiple times to exclude multiple patterns or\n                   start with @ to retrieve from a file\n  -off             disabled the processing\n  -noopt           doesn't optimizes output ids by frequency\n  -m|-mapfile      name of map to generate with a list in-ids=out-ids\n                   if the mapfile ends with .json it will output a json format\n  -idfile          input filename with the list of ids,\n                   separated by LF or CRLF to be uglified\n                   lines starting with # will be discarded\n  -ins|-insuffix   input id suffix. default is _UG.\n                   use '.' to disactivate the default input suffix\n  -outp|-outprefix output id prefix. default is ug_\n  -v               verbose\n  -version         version\n\n  e.g.\n  " + SCRIPTNAME + " -in in-folder -out out-folder -m test/outmap.txt test/in-folder/**\n\n      Reads test/in-folder/**, processes the ids,\n      outputs the to test/out-folder/**\n      and writes the id map to test/outmap.txt\n\n  " + SCRIPTNAME + " -noopt -in in-folder -out out-folder -ins . -ous ug__ -idfile test/idlist.txt -m test/outmap.json -e '*.css' test/in-folder/**\n\n    Same as above but deactivates order id by frequency,\n    the out map is in .json format,\n    loads an idlist file to uglify,\n    the output prefix is ug__ instead of ug_,\n    excludes all the '.css' files\n    and deactivates the default input prefix\n\n  " + SCRIPTNAME + " -noopt -in '\\.(\\w+)$' -out '.out.$1' test/in-folder/**\n\n    Writes the output to the same folder but adds  .out to the extension\n    input is test/in-folder/**\n    output will be test/in-folder/test-input.out.js\n");
}
// ------------------------------------------------------------------------
//                               I/O tools
// ------------------------------------------------------------------------
function loadText(fileName, encoding) {
    return fs.readFileSync(fileName, { encoding: encoding || 'utf-8' });
}
function saveText(fileName, data) {
    fs.writeFileSync(fileName, data);
}
function saveJson(fileName, obj, format) {
    fs.writeFileSync(fileName, format === false ? JSON.stringify(obj) :
        JSON.stringify(obj, null, format !== undefined ? format : 2));
}
function loadTextLines(fileName, encoding) {
    if (!fs.existsSync(fileName)) {
        var msg = fileName + " doesn't exists!";
        log(msg, true);
        throw msg;
    }
    var lines = loadText(fileName).split('\n');
    var outLines = [];
    lines.forEach(function (line) {
        line = line.trim();
        if (line && line[0] !== '#') {
            outLines.push(line);
        }
    });
    return outLines;
}
function mkdirp(dir) {
    if (dir !== '' && dir !== '/' && !fs.existsSync(dir)) {
        mkdirp(node_path.dirname(dir));
        fs.mkdirSync(dir);
    }
}
function ensureDirExists(fileName) {
    var dir = node_path.dirname(fileName);
    mkdirp(dir);
}
// ------------------------------------------------------------------------
//                               Logging
// ------------------------------------------------------------------------
function log(msg, isError) {
    if (isError === void 0) { isError = false; }
    if (!isError)
        console.log(msg);
    else
        console.log("ERROR: " + msg);
}
// ------------------------------------------------------------------------
//                               processFiles
// ------------------------------------------------------------------------
function processFiles() {
    var idsByFreq = {};
    // excludes words starting with digits
    var inRegExList = [];
    if (opts.inpIdSuffix !== '.')
        inRegExList.push(new RegExp('\\b(_*[A-Z]\\w+' + opts.inpIdSuffix + ')\\b', 'gi'));
    else if (opts.isVerbose)
        log("No default Id Suffix");
    // loads Id List
    if (opts.inpIdListFileName !== '') {
        if (opts.isVerbose)
            log("Id fileName: " + opts.inpIdListFileName);
        loadTextLines(opts.inpIdListFileName).forEach(function (id) {
            inRegExList.push(new RegExp("\\b(" + id + ")\\b", 'g'));
        });
    }
    // 1-step: Scan all the input files for word frequency
    opts.workFileList.forEach(function (file) {
        inRegExList.forEach(function (inRegEx) {
            var mat = loadText(file.in).match(inRegEx);
            if (mat) {
                mat.forEach(function (id) { return idsByFreq[id] = (idsByFreq[id] || 0) + 1; });
            }
        });
    });
    // sorts ids by frequency
    var idsAndFreq = Object.keys(idsByFreq).map(function (id) { return [id, idsByFreq[id]]; });
    if (!opts.noOpt) {
        if (opts.isVerbose)
            log("Sorting Ids by Frequency");
        idsAndFreq.sort(function (a, b) { return b[1] - a[1]; });
    }
    var mapData = [];
    var idsInpToOut = {};
    // builds output ids and
    idsAndFreq.forEach(function (idAndFreq, index) {
        var id = idAndFreq[0];
        idsInpToOut[id] = opts.outIdPrefix + index;
        if (!opts.outMapFileIsJson)
            mapData.push(opts.outIdPrefix + index + '=' + id);
    });
    // saves Map File
    if (opts.outMapFileName) {
        ensureDirExists(opts.outMapFileName);
        if (!opts.outMapFileIsJson) {
            if (opts.isVerbose)
                log("Saving mapfile in text format: " + opts.outMapFileName);
            saveText(opts.outMapFileName, mapData.join('\n'));
        }
        else {
            if (opts.isVerbose)
                log("Saving mapfile in JSON format: " + opts.outMapFileName);
            saveJson(opts.outMapFileName, idsInpToOut);
        }
    }
    // 2-step: Builds output tree
    opts.workFileList.forEach(function (file) {
        var lines = loadText(file.in);
        if (opts.isActive) {
            inRegExList.forEach(function (inRegEx) {
                lines = lines.replace(inRegEx, function (match, p1) { return idsInpToOut[p1]; });
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
    var argv = process.argv;
    var curArg;
    var inpFileGlobs = [];
    var exclFileGlobs = [];
    var exclMiniMatches = [];
    function peekArg(toRemove) {
        if (argv.length > 0) {
            curArg = argv[0];
            if (toRemove) {
                argv.shift();
            }
            return curArg;
        }
        else {
            return '';
        }
    }
    argv.splice(0, 2);
    while (argv.length > 0) {
        if (opts.isVerbose)
            log("option: " + peekArg(false));
        switch (peekArg(true)) {
            case '-off':
                opts.isActive = false;
                log("Disactivated " + SCRIPTNAME);
                break;
            case '-noopt':
                opts.noOpt = true;
                break;
            case '-v':
                opts.isVerbose = true;
                break;
            case '-version':
                log(SCRIPTNAME + " " + VERSION);
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
            case '-e':
                var exclFileGlob = peekArg(true);
                if (exclFileGlob[0] === '@') {
                    var globExclFileName = exclFileGlob.substr(1);
                    exclFileGlobs = inpFileGlobs.concat(loadTextLines(globExclFileName));
                }
                else {
                    exclFileGlobs.push(exclFileGlob);
                }
                break;
            default:
                do {
                    if (curArg[0] === '@') {
                        var globFileName = curArg.substr(1);
                        inpFileGlobs = inpFileGlobs.concat(loadTextLines(globFileName));
                    }
                    else {
                        inpFileGlobs.push(curArg);
                    }
                } while (peekArg(true));
        }
    }
    if (!opts.inputFilePattern || !opts.outputFilePattern) {
        printUsage();
        return false;
    }
    var re = new RegExp(opts.inputFilePattern);
    exclMiniMatches = exclFileGlobs.map(function (exclFileGlob) {
        return new minimatch.Minimatch(exclFileGlob, { matchBase: true });
    });
    // scans all the file names using glob
    if (opts.isVerbose)
        log("input file globs: " + inpFileGlobs);
    var endCount = 0;
    inpFileGlobs.forEach(function (inFileGlob, globIndex) {
        var gb = new glob.Glob(inFileGlob, {
            nosort: true,
        });
        gb.on('match', function (inFileName) {
            if (fs.lstatSync(inFileName).isFile()) {
                if (exclMiniMatches.some(function (exclMiniMatch) { return exclMiniMatch.match(inFileName); })) {
                    return;
                }
                if (opts.isVerbose)
                    log("input fileName: " + inFileName);
                var outFileName = inFileName.replace(re, opts.outputFilePattern);
                if (inFileGlob !== outFileName) {
                    if (opts.isVerbose)
                        log("output fileName: " + outFileName);
                    opts.workFileList.push({ in: inFileName, out: outFileName });
                }
                else {
                    log(inFileName + " has the same output fileName", true);
                }
            }
        });
        gb.on('end', function () {
            endCount++; // since glob might be racing, this garanties all the glob have finished
            if (endCount === inpFileGlobs.length) {
                if (opts.isVerbose)
                    log("all globs have finished");
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
//# sourceMappingURL=id-uglifier.js.map