/* Copyright (c) wow.export contributors. All rights reserved. */
/* Licensed under the MIT license. See LICENSE in project root for license information. */
import State from '../state';
import Events from '../events';
import * as log from '../log';
import ExportHelper from '../casc/export-helper';
import { BLTEIntegrityError } from '../casc/blte-reader';
import * as generics from '../generics';
import * as listfile from '../casc/listfile';

State.registerLoadFunc(async () => {
	// Track when the user clicks to export selected sound files.
	Events.on('click-export-video', async () => {
		const userSelection = State.selectionVideos;
		if (userSelection.length === 0) {
			State.setToast('info', 'You didn\'t select any files to export; you should do that first.');
			return;
		}

		const helper = new ExportHelper(userSelection.length, 'video');
		helper.start();

		const overwriteFiles = State.config.overwriteFiles;
		for (let fileName of userSelection) {
			// Abort if the export has been cancelled.
			if (helper.isCancelled())
				return;

			fileName = listfile.stripFileEntry(fileName);
			const exportPath = ExportHelper.getExportPath(fileName);
			let isCorrupted = false;

			if (overwriteFiles || !await generics.fileExists(exportPath)) {
				try {
					const data = await State.casc.getFileByName(fileName);
					await data.writeToFile(exportPath);

					helper.mark(fileName, true);
				} catch (e) {
					// Corrupted file, often caused by users cancelling a cinematic while it is streaming.
					if (e instanceof BLTEIntegrityError)
						isCorrupted = true;
					else
						helper.mark(fileName, false, e.message);
				}

				if (isCorrupted) {
					try {
						log.write('Local cinematic file is corrupted, forcing fallback.');

						// In the event of a corrupted cinematic, try again with forced fallback.
						const data = await State.casc.getFileByName(fileName, false, false, true, true);
						await data.writeToFile(exportPath);

						helper.mark(fileName, true);
					} catch (e) {
						helper.mark(fileName, false, e.message);
					}
				}
			} else {
				helper.mark(fileName, true);
				log.write('Skipping video export %s (file exists, overwrite disabled)', exportPath);
			}
		}

		helper.finish();
	});
});