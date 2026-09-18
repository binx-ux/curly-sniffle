# contributing

cool that you want to mess with this. keep it simple.

## setup

1. clone this repo
2. have a [Vencord](https://github.com/Vendicated/Vencord) source build nearby
3. run `install.bat` or copy a plugin folder into `Vencord/src/userplugins/`
4. `pnpm build`, apply dist, restart Discord

## adding a plugin

this repo is badge / profile / music stuff. put new plugins under:

```
profile/
music/
```

each plugin is its own folder with an `index.tsx` (or `index.ts`).

then add the path to the copy loop in `install.bat`.

## style

- write like a normal person wrote the code
- no giant comment headers
- smallest change that works
- match whatever the neighboring plugins already do

## prs

- one thing per pr if you can
- say what it does in plain english
- test it in Discord before opening the pr (enable with Show All)

## bugs

open an issue with:

- which plugin
- what you did
- what happened
- vencord / discord desktop if you know it

thats it.
