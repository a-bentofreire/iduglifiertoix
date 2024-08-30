# Description

[IdUglifierToIX](https://www.devtoix.com/en/projects/iduglifiertoix) is a 2-pass brute force code id uglifier.  

IdUglifierToIX is distributed as a *npm* package, and it's an update from the deprecated `id-uglifier` package.
  
It works based on the raw assumption that every identifier that ends  
with **_UG** is subject to uglification. It also accepts a table of identifiers to be uglified.  
  
**IdUglifierToIX** is language agnostic and not only uglifies source code but also  
css, html, text and whatever you feed it.  
In essence, you provide it a file tree and it will generate and output file tree  
where every id that matches a pattern will be replace with **ug_NNNN**. 
  
At first glance, it might look like that it's too blind for industrial-strength projects,  
but the probability of running into an external library where the ids end with _UG is very low.  
And, if such case occurs, IdUglifierToIX allows to define another id suffix.
  
**IdUglifierToIX** isn't built for existing projects, but instead of projects  
where the business logic is prepared from inception for id uglification,  
the extra prefix will give clues to the developers that  
that id will be changed in the final output.  

## Installation

`[sudo] npm install -g iduglifiertoix`  

## Usage

`iduglifiertoix [options] input-file-globs`

`input-file-globs` is a list of glob patterns https://www.npmjs.com/package/glob  
or if starts with @ it will be read from a file with same rules as -id-file  
**IdUglifierToIX** has a safety mechanism to never overwrite the input  
  
Where the options are:

```plaintext
    -in pattern      input filename regex pattern  
    -out pattern     output filename pattern  
    -e exclude-files this is a glob pattern [https://github.com/isaacs/minimatch]  
                     that excludes files from being processed.  
                     Use multiple times to exclude multiple patterns or  
                     start with @ to retrieve from a file  
    -off             disabled the processing  
    -no-opt          doesn't optimizes output ids by frequency  
    -m|-map-file     name of map to generate with a list in-ids=out-ids  
                     if the map-file ends with .json it will output a json format  
    -id-file         input filename with the list of ids,  
                     separated by LF or CRLF to be uglified  
                     lines starting with # will be discarded  
    -ins|-in-suffix  input id suffix. default is _UG.  
                     use '.' to deactivates the default input suffix  
    -outp|-out-prefix output id prefix. default is ug_  
    -v               verbose  
    -version         version  
```

## Examples

`iduglifiertoix -in in-folder -out out-folder -m test/outmap.txt test/in-folder/**`  

Reads `test/in-folder/**`, processes the ids,  
outputs the to `test/out-folder/**`  
and writes the id map to `test/outmap.txt`  
If `out-folder` doesn't exists, it creates it on the fly  

`iduglifiertoix -no-opt -in in-folder -out out-folder -ins . -ous ug__ -id-file test/id-list.txt -m test/outmap.json -e '*.css' test/in-folder/**`  

Same as above but deactivates order id by frequency,  
the out map is in .json format,  
loads an id-list file to uglify,  
the output prefix is ug__ instead of ug_,  
excludes all the '.css' files  
and disactivates the default input prefix  

`iduglifiertoix -no-opt -in '\\.(\\w+)$' -out '.out.$1' test/in-folder/**`  

Writes the output to the same folder but adds  .out to the extension  
input is ``test/in-folder/**``  
output will be `test/in-folder/test-input.out.js`  

## Example Input/Output

## Input

```javascript
function testFunc() {  
    var _this_is_a_var_UG = 3;  
    var high_freq_UG = 7;  
    high_freq_UG++;  
    high_freq_UG++;  
}
```

## Output

```javascript
function testFunc() {  
    var ug_1 = 3;  
    var ug_0 = 7;  
    ug_0++;  
    ug_0++;  
}
```

## Support this Project

Give the project a Star ⭐ or visit the project [homepage](https://www.devtoix.com/en/projects/iduglifiertoix)

## License

MIT

## Copyrights

(c) 2018-2024 [Alexandre Bento Freire](https://www.a-bentofreire.com)