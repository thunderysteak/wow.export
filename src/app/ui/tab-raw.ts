/* Copyright (c) wow.export contributors. All rights reserved. */
/* Licensed under the MIT license. See LICENSE in project root for license information. */
import util from 'node:util';

import State from '../state';
import Events from '../events';
import Log from '../log';
import ExportHelper from '../casc/export-helper';
import Constants from '../constants';
import { redraw, fileExists } from '../generics';
import Listfile from '../casc/listfile';

let isDirty = true;

async function computeRawFiles(): Promise<void> {
	if (isDirty) {
		isDirty = false;

		if (State.state.config.enableUnknownFiles) {
			State.state.setToast('progress', 'Scanning game client for all files...');
			await redraw();

			const rootEntries = State.state.casc.getValidRootEntries();
			State.state.listfileRaw = Listfile.formatEntries(rootEntries);
			State.state.setToast('success', util.format('Found %d files in the game client', State.state.listfileRaw.length));
		} else {
			State.state.setToast('progress', 'Scanning game client for all known files...');
			await redraw();

			State.state.listfileRaw = Listfile.getFullListfile();
			State.state.setToast('success', util.format('Found %d known files in the game client', State.state.listfileRaw.length));
		}
	}
}

Events.on('screen-tab-raw', () => computeRawFiles());
Events.on('listfile-needs-updating', () => {
	isDirty = true;
});

Events.once('casc-ready', () => {
	State.state.$watch('config.cascLocale', () => {
		isDirty = true;
	});
});

// Track when the user clicks to auto-detect raw files.
Events.on('click-detect-raw', async () => {
	const userSelection = State.state.selectionRaw;
	if (userSelection.length === 0) {
		State.state.setToast('info', 'You didn\'t select any files to detect; you should do that first.');
		return;
	}

	const filteredSelection: Array<number> = [];
	for (let fileName of userSelection) {
		fileName = Listfile.stripFileEntry(fileName);
		const match = fileName.match(/^unknown\/(\d+)(\.[a-zA-Z_]+)?$/);

		if (match)
			filteredSelection.push(parseInt(match[1]));
	}


	if (filteredSelection.length === 0) {
		State.state.setToast('info', 'You haven\'t selected any unknown files to identify.');
		return;
	}

	State.state.isBusy++;

	const extensionMap = new Map();
	let currentIndex = 1;

	for (const fileDataID of filteredSelection) {
		State.state.setToast('progress', util.format('Identifying file %d (%d / %d)', fileDataID, currentIndex++, filteredSelection.length));

		try {
			const data = await State.state.casc.getFile(fileDataID);
			for (const check of Constants.FILE_IDENTIFIERS) {
				if (data.startsWith(check.match)) {
					extensionMap.set(fileDataID, check.ext);
					Log.write('Successfully identified file %d as %s', fileDataID, check.ext);
					break;
				}
			}
		} catch (e) {
			Log.write('Failed to identify file %d due to CASC error', fileDataID);
		}
	}

	if (extensionMap.size > 0) {
		Listfile.ingestIdentifiedFiles(extensionMap);
		await computeRawFiles();

		if (extensionMap.size === 1) {
			const [fileDataID, ext] = extensionMap.entries().next().value;
			State.state.setToast('success', util.format('%d has been identified as a %s file', fileDataID, ext));
		} else {
			State.state.setToast('success', util.format('Successfully identified %d files', extensionMap.size));
		}

		State.state.setToast('success', util.format('%d of the %d selected files have been identified and added to relevant file lists', extensionMap.size, filteredSelection.length));
	} else {
		State.state.setToast('info', 'Unable to identify any of the selected files.');
	}

	State.state.isBusy--;
});

// Track when the user clicks to export selected raw files.
Events.on('click-export-raw', async () => {
	const userSelection = State.state.selectionRaw;
	if (userSelection.length === 0) {
		State.state.setToast('info', 'You didn\'t select any files to export; you should do that first.');
		return;
	}

	const helper = new ExportHelper(userSelection.length, 'file');
	helper.start();

	const overwriteFiles = State.state.config.overwriteFiles;
	for (let fileName of userSelection) {
		// Abort if the export has been cancelled.
		if (helper.isCancelled())
			return;

		fileName = Listfile.stripFileEntry(fileName);
		const exportPath = ExportHelper.getExportPath(fileName);

		if (overwriteFiles || !await fileExists(exportPath)) {
			try {
				const data = await State.state.casc.getFileByName(fileName, true);
				await data.writeToFile(exportPath);

				helper.mark(fileName, true);
			} catch (e) {
				helper.mark(fileName, false, e.message);
			}
		} else {
			helper.mark(fileName, true);
			Log.write('Skipping file export %s (file exists, overwrite disabled)', exportPath);
		}
	}

	helper.finish();
});