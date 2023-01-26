import meta from './package.json' assert { type: 'json' };
import log, { formatArray } from '@kogs/logger';
import { execSync } from 'child_process';
import { copySync, collectFiles } from '@kogs/utils';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import util from 'node:util';
import path from 'node:path';
import rcedit from 'rcedit';
import fs from 'node:fs';

const INCLUDE = {
	'LICENSE': 'license/LICENSE',
	'CHANGELOG.md': 'src/CHANGELOG.md',
	'resources/icon.png': 'res/icon.png',
	'addons/blender/io_scene_wowobj': 'addon/io_scene_wowobj',
	'src/default_config.jsonc': 'src/default_config.jsonc',
	'src/index.html': 'src/index.html',
	'src/fa-icons': 'src/fa-icons',
	'src/shaders': 'src/shaders',
	'src/images': 'src/images',
	'src/fonts': 'src/fonts',
	'src/lib': 'src/lib',
};

const REMAP = {
	'credits.html': 'license/nwjs.html',
	'nw.exe': 'wow.export.exe'
};

try {
	const run = (cmd, ...params) => {
		cmd = util.format(cmd, ...params);
		log.info('> %s', cmd);
		execSync(cmd, { stdio: 'inherit' });
	};

	const BUILD_TYPES = ['debug', 'release'];
	const buildType = process.argv.slice(2)[0];

	if (!BUILD_TYPES.includes(buildType))
		throw new Error(`Invalid build type: {${buildType}}, must be one of: ${formatArray(BUILD_TYPES)}`);

	const isDebugBuild = buildType === 'debug';
	const buildDir = path.join('bin', isDebugBuild ? 'win-x64-debug' : 'win-x64');
	log.info('Building {%s} in {%s}...', buildType, path.resolve(buildDir));

	// Step 1: Run `rollup` to bundle our app to a single `app.js` file.
	// This will run `tsc` (via `rollup-plugin-typescript2`) to compile TypeScript source code.
	// This will also run `terser` (via `@rollup/plugin-terser`) to minify/optimize the output.
	// See `rollup.config.js` for how these are configured.
	// See https://rollupjs.org/command-line-interface/ for usage information.
	log.info('Running {tsc}, {terser}, {rollup}...');
	run('rollup --config rollup.config.js --environment "BUILD_TYPE:%s,BUILD_DIR:%s"', buildType, buildDir);

	// Step 2: Run `sass` to compile our SCSS to CSS to a single `app.css` file.
	// See https://sass-lang.com/documentation/cli/dart-sass for usage information.
	log.info('Running {sass}...');
	run('sass src/app.scss %s --no-source-map --style %s', path.join(buildDir, 'src', 'app.css'), isDebugBuild ? 'expanded' : 'compressed');

	// Step 3: Build nw.js distribution using `@kogs/nwjs'.
	// See https://github.com/Kruithne/kogs-nwjs for usage information.
	log.info('Running {@kogs/nwjs}...');
	run('nwjs --target-dir "%s" --version 0.69.1 --platform win --arch x64 --remove-pak-info --locale en-US --exclude "^notification_helper.exe$"' + (isDebugBuild ? ' --sdk' : ''), buildDir);

	// Step 4: Copy and adjust the package manifest.
	log.info('Generating {package.json} for distribution...');
	const manifest = JSON.parse(fs.readFileSync('./src/package.json', 'utf8'));
	for (const key of ['name', 'description', 'license', 'version', 'contributors', 'bugs', 'homepage'])
		manifest[key] = meta[key];

	manifest.guid = uuidv4(); // Unique build ID for updater.
	manifest.flavour = 'win-x64' + (isDebugBuild ? '-debug' : '');

	fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(manifest, null, '\t'), 'utf8');

	// Step 5: Copy additional source files.
	log.info('Copying files...');
	log.indent();
	for (let [src, dest] of Object.entries(INCLUDE)) {
		dest = path.join(buildDir, dest);
		fs.mkdirSync(path.dirname(dest), { recursive: true });

		copySync(src, dest, { overwrite: 'newer' });
		log.success('{%s} -> {%s}', src, dest);
	}
	log.outdent();

	// Step 6: File remapping.
	log.info('Remapping build files...');
	log.indent();
	for (let [src, dest] of Object.entries(REMAP)) {
		dest = path.join(buildDir, dest);
		fs.mkdirSync(path.dirname(dest), { recursive: true });

		fs.renameSync(path.join(buildDir, src), dest);
		log.success('{%s} -> {%s}', src, dest);
	}
	log.outdent();

	// Step 7: Run `rcedit` to edit the executable metadata.
	// See https://www.npmjs.com/package/rcedit for usage information.
	log.info('Modifying executable metadata for {wow.export.exe}...');
	await rcedit(path.join(buildDir, 'wow.export.exe'), {
		'icon': './resources/icon.ico',
		'file-version': meta.version,
		'product-version': meta.version,
		'version-string': {
			'CompanyName': 'kruithne.net',
			'FileDescription': 'Export Toolkit for World of Warcraft',
			'LegalCopyright': 'MIT License',
			'ProductName': 'wow.export',
			'OriginalFilename': 'wow.export.exe'
		}
	});

	// Step 8: Build updater executable, bundle and manifest (release builds only).
	if (!isDebugBuild) {
		// Step 8.1: Compile updater executable using `pkg`.
		// See https://github.com/vercel/pkg for usage information.
		log.info('Compiling {updater.exe}...');
		run('pkg --target node12-win-x64 --output "%s" "%s"', path.join(buildDir, 'updater.exe'), path.join('src', 'updater.js'));

		// Step 8.1.1: Run `rcedit` to edit the updater executable metadata.
		// See https://www.npmjs.com/package/rcedit for usage information.
		log.info('Modifying executable metadata for {updater.exe}...');
		await rcedit(path.join(buildDir, 'updater.exe'), {
			'icon': './resources/icon.ico',
			'file-version': '2.0', // Avoid incrementing every build.
			'product-version': '2.0', // Avoid incrementing with every build.
			'version-string': {
				'CompanyName': 'kruithne.net',
				'FileDescription': 'wow.export updater',
				'LegalCopyright': 'MIT License',
				'ProductName': 'wow.export',
				'OriginalFilename': 'updater.exe'
			}
		});

		// Step 8.2: Compile update file/manifest.
		log.info('Writing update package...');

		const updateManifest = {};
		const updateFiles = await collectFiles(buildDir);
		const updatePath = path.join(buildDir, 'update');

		let entryCount = 0;
		let totalSize = 0;
		let compSize = 0;

		for (const file of updateFiles) {
			const relative = path.posix.relative(buildDir, file);
			const data = fs.readFileSync(file);
			const hash = crypto.createHash('sha256').update(data).digest('hex');

			const dataCompressed = zlib.deflateSync(data);
			fs.writeFileSync(updatePath, dataCompressed, { flag: 'a' });

			updateManifest[relative] = { hash, size: data.length, compSize: dataCompressed.length, ofs: compSize };
			totalSize += data.length;
			compSize += dataCompressed.length;

			entryCount++;
		}

		const manifestData = { contents: updateManifest, guid: manifest.guid };
		fs.writeFileSync(path.join(buildDir, 'update.json'), JSON.stringify(manifestData, null, '\t'), 'utf8');
		
		const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
		const compSizeMB = (compSize / 1024 / 1024).toFixed(2);
		log.success('Compressed update package with {%s} entries ({%smb} => {%smb})', entryCount, totalSizeMB, compSizeMB);
	}

	log.outdent();
} catch (err) {
	log.error('{Failed} %s: ' + err.message, err.name);
}