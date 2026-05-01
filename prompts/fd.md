Fast file and directory finding using fd. A modern, fast alternative to the `find` command.

<trigger>
Use `find_files` when you know EXACT file criteria: name, extension, or type.
"List all .ts files", "Find files named config" → `find_files`
For approximate/fuzzy filenames → `fuzzy_find`
For file CONTENTS → `search`
</trigger>

<instruction>
- Searches for files/directories by name (default), regex pattern, glob, or extension
- Much faster than `find` — uses parallelism and respects `.gitignore` by default
- Case-insensitive by default (use `caseSensitive` for exact matching)
- Use `pattern` for regex matching, `glob` for glob patterns, or `extension` for file type
- Empty pattern lists all files (up to limit)
- Use `hidden` to include hidden/dotfiles, `noIgnore` to include gitignored files
</instruction>

<output>
Output is a list of matched file/directory paths, one per line.
</output>

<guidelines>
- Use `find_files` for finding files by name, extension, or type
- Use `search` (ripgrep) when you need to search file *contents*
- Use `find_files` when you'd normally use `find` — it's faster and has better defaults
- Combine `find_files` with `search` in two phases: find files with find_files, then grep contents with search
</guidelines>
