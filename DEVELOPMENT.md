## WARNING: LIVE POISON SCORPIONS
Now that I have your attention, please be aware that the instructions in this guide are probably not for you.

**YOU DO NOT NEED TO FOLLOW ANYTHING IN THIS GUIDE TO OBTAIN OR USE THIS SOFTWARE.**

The latest release of wow.export can always be found over on our [website](https://www.kruithne.net/wow.export/) or the [releases page](https://github.com/Kruithne/wow.export/releases). We release updates and fixes on a regular basis.

Unless you are contributing to or forking this project, you do not need to follow any of the instructions in this guide. If you are looking to contribute, please ensure you have read the [CONTRIBUTING.md](CONTRIBUTING.md) document first.

## Disclaimer
The instructions below assume you have a basic understanding of how to use the command line and Git, as well as a basic understanding of developing software.

If you run into issues, please join the [Discord server](https://discord.gg/kC3EzAYBtf) and ask for help in the `#wow-export-dev` channel, but keep in mind you are expected to have a basic understanding of the tools and processes used.

## Preparing Development Environment
Before you start developing wow.export, you will need to set-up your environment.

- Step 1: (Windows Only) Install WSL 2 and Ubuntu 20.04 LTS
  - [Install WSL 2](https://docs.microsoft.com/en-us/windows/wsl/install-win10)
  - [Install Ubuntu 20.04 LTS](https://docs.microsoft.com/en-us/windows/wsl/install-manual)
  - Following instructions and building must be done inside a WSL 2 environment, as the build scripts are not compatible with native Windows (yet).
- Step 2: Install [Bun](https://bun.sh/) (0.6.3+)
  - `curl -fsSL https://bun.sh/install | bash`
- Step 3: Install the following packages globally:
  - `npm install --global nwjs-installer resedit-cli`
- Step 4: Clone the repository:
  - `git clone`
- Step 5: Install dependencies:
  - `bun install`

## Linting
wow.export uses [ESLint](https://eslint.org/) to enforce code style and best practices. While not required, it is highly recommended that you install an [ESLint plugin](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for your editor of choice.

Pull requests that do not pass the linter will automatically fail the CI checks and will not be merged.

## Building Locally
To build wow.export, you will need to run the `build` script from the command line.

```bash
bun run ./build.ts
```

The above command is going to do nothing unless it is provided with options, which are listed below.

```
--debug 	 Build the debug version of wow.export.
--framework  Builds the framework into the build directory.
--code       Compiles TypeScript/SCSS into the build directory.
--assets     Copies static assets into the build directory.
--package    Produces a release package (ZIP).
--update     Generates files for the update server.
```

For most development, you will want to build a debug version of wow.export and run it locally.

```bash
bun run ./build.ts --debug --framework --code --assets
```

When you make changes to the source, you will only need to recompile the source code rather than re-building the entire application.

```bash
bun run ./build.ts --code
```

For quicker access, the following scripts are provided in the `package.json` file:

```bash
bun run build # --code --assets --framework
bun run build-debug # --debug --code --assets --framework
bun run update # --code
bun run update-debug # --code
bun run build-release # --code --assets --framework --package --update
```

### Assets
The assets copied over by `--assets` are defined at the top of the [`build`](build.js) script. If these files are changed, you will need to re-run the `--assets` flag.

### Code
When the `--code` flag is included, the following steps will be taken:
- `app.ts` is bundled with everything it imports and then compiled as TypeScript. The code is then minified and dead code is removed (not in --debug).

### Debug
When providing the `--debug` option, the following differences will be made to the build:
- Framework (if included with --framework) will use the SDK version of nw.js rather than the release version.
- DevTools will be enabled and automatically start when the application is launched.
- The source files (if included with --code) will not be minified or have dead code removed.
- The environment variable `process.env.BUILD_TYPE` will be `development`, instead of `release`.
- The `updater.exe` will not be included in the build.

## Testing
Testing is done using [Bun](https://bun.sh/docs/cli/test). To run the tests, you will need to run the following command.

```bash
bun test
```

All tests must pass before a pull request can be merged.

When contributing to wow.export, you are expected to write tests for any new features or bug fixes.

## Deployment
The versions of wow.export that are built and deployed to end-users is handled automatically by GitHub Actions. The builds are subject to automated testing and must pass before they are deployed.