# Description

id-uglifier is a 2-pass brute force code uglifier.  
  
It works based on the raw assumption that every identifier that ends  
with **_UG** is subject to uglification. It also accepts a table of identifiers to be uglified.  
  
id-uglifier is language agnostic and not only uglifies source code but also  
css, html, text and whatever you feed it.  
In essence, you provide it a file tree and it will generate and output file tree  
where every id that matches a pattern will be replace with **ug_NNNN**. 
  
At first glance, it might look like that it's too blind for industrial-strength projects,  
but the probability of running into an external library where the ids end with _UG is very low.  
And, if such case occurs, id-uglifier allows to define another id suffix.
  
id-uglifier isn't built for existing projects, but instead of projects  
where the business logic is prepared from inception for id uglification,  
the extra prefix will give clues to the developers that  
that id will be changed in the final output.  

# Installation

`npm install id-uglifier`  

# Usage

`id-uglifier [options] input-file-globs`

input-file-globs is a list of glob patterns https://www.npmjs.com/package/glob  
or if starts with @ it will be read from a file with same rules as -idfile  
id-uglifier has a safety mechanism to never overwrite the input  
  
Where the options are:  
```
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
                     use '.' to deactivates the default input suffix  
    -outp|-outprefix output id prefix. default is ug_  
    -v               verbose  
    -version         version  
```

# Examples

`id-uglifier -in in-folder -out out-folder -m tests/outmap.txt tests/in-folder/**`  

Reads `tests/in-folder/**`, processes the ids,  
outputs the to `tests/out-folder/**`  
and writes the id map to tests/outmap.txt  

`id-uglifier -noopt -in in-folder -out out-folder -ins . -ous ug__ -idfile tests/idlist.txt -m tests/outmap.json tests/in-folder/**`  

Same as above but desactivates order id by frequency,  
the out map is in .json format,  
loads an idlist file to uglify,  
the output prefix is ug__ instead of ug_,  
and disactivates the default input prefix  

`id-uglifier -noopt -in '\\.(\\w+)$' -out '.out.$1' tests/in-folder/**`  

Writes the output to the same folder but adds  .out to the extension  
input is ``tests/in-folder/**``  
output will be `tests/in-folder/test-input.out.js`  

# License

[MIT License+uuid License](https://github.com/a-bentofreire/uuid-licenses/blob/master/MIT-uuid-license.md)

# Copyright

(c) 2018 Alexandre Bento Freire