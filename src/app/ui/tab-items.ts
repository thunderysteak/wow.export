/* Copyright (c) wow.export contributors. All rights reserved. */
/* Licensed under the MIT license. See LICENSE in project root for license information. */
import State from '../state';
import Events from '../events';
import * as listfile from '../casc/listfile';
import MultiMap from '../MultiMap';

import * as DBTextureFileData from '../db/caches/DBTextureFileData';
import * as DBModelFileData from '../db/caches/DBModelFileData';

import WDCReader from '../db/WDCReader';
import * as ItemSlot from '../wow/ItemSlot';

const ITEM_SLOTS_IGNORED = [0, 18, 11, 12, 24, 25, 27, 28];

const ITEM_SLOTS_MERGED = {
	'Head': [1],
	'Neck': [2],
	'Shoulder': [3],
	'Shirt': [4],
	'Chest': [5, 20],
	'Waist': [6],
	'Legs': [7],
	'Feet': [8],
	'Wrist': [9],
	'Hands': [10],
	'One-hand': [13],
	'Off-hand': [14, 22, 23],
	'Two-hand': [17],
	'Main-hand': [21],
	'Ranged': [15, 26],
	'Back': [16],
	'Tabard': [19]
};

export default class Item {
	id: number;
	name: string;
	inventoryType: number;
	quality: number;
	icon: number;
	models: Array<string>;
	textures: Array<string>;
	modelCount: number;
	textureCount: number;

	/**
	 * Construct a new Item instance.
	 * @param id
	 * @param itemSparseRow
	 * @param itemAppearanceRow
	 * @param textures
	 * @param models
	 */
	constructor(id: number, itemSparseRow: any, itemAppearanceRow: any | null, textures: Array<string> | null, models: Array<string> | null) {
		this.id = id;
		this.name = itemSparseRow.Display_lang;
		this.inventoryType = itemSparseRow.InventoryType;
		this.quality = itemSparseRow.OverallQualityID;

		this.icon = itemAppearanceRow?.DefaultIconFileDataID ?? 0;

		this.models = models;
		this.textures = textures;

		this.modelCount = this.models?.length ?? 0;
		this.textureCount = this.textures?.length ?? 0;
	}

	/**
	 * Returns item slot name for this items inventory type.
	 */
	get itemSlotName(): string {
		return ItemSlot.getSlotName(this.inventoryType);
	}

	/**
	 * Returns the display name for this item entry.
	 */
	get displayName(): string {
		return this.name + ' (' + this.id + ')';
	}
}

/**
 * Switches to the model viewer, selecting the models for the given item.
 * @param item
 */
export function viewItemModels(item) {
	State.setScreen('tab-models');

	const list = new Set();

	for (const modelID of item.models) {
		const fileDataIDs = DBModelFileData.getModelFileDataID(modelID);
		for (const fileDataID of fileDataIDs) {
			let entry = listfile.getByID(fileDataID);

			if (entry !== undefined) {
				if (State.config.listfileShowFileDataIDs)
					entry += ' [' + fileDataID + ']';

				list.add(entry);
			}
		}
	}

	// Reset the user filter for models.
	State.userInputFilterModels = '';

	State.overrideModelList = [...list];
	State.selectionModels = [...list];
	State.overrideModelName = item.name;
}

/**
 * Switches to the texture viewer, selecting the models for the given item.
 * @param item
 */
export function viewItemTextures(item) {
	State.setScreen('tab-textures');

	const list = new Set();

	for (const textureID of item.textures) {
		const fileDataID = DBTextureFileData.getTextureFileDataID(textureID);
		let entry = listfile.getByID(fileDataID);

		if (entry !== undefined) {
			if (State.config.listfileShowFileDataIDs)
				entry += ' [' + fileDataID + ']';

			list.add(entry);
		}
	}

	// Reset the user filter for textures.
	State.userInputFilterTextures = '';

	State.overrideTextureList = [...list];
	State.selectionTextures = [...list];
	State.overrideTextureName = item.name;
}

Events.once('screen-tab-items', async () => {
	// Initialize a loading screen.
	const progress = State.createProgress(5);
	State.setScreen('loading');
	State.isBusy++;

	await progress.step('Loading item data...');
	const itemSparse = new WDCReader('DBFilesClient/ItemSparse.db2');
	await itemSparse.parse();

	await progress.step('Loading item display info...');
	const itemDisplayInfo = new WDCReader('DBFilesClient/ItemDisplayInfo.db2');
	await itemDisplayInfo.parse();

	await progress.step('Loading item appearances...');
	const itemModifiedAppearance = new WDCReader('DBFilesClient/ItemModifiedAppearance.db2');
	await itemModifiedAppearance.parse();

	await progress.step('Loading item materials...');
	const itemDisplayInfoMaterialRes = new WDCReader('DBFilesClient/ItemDisplayInfoMaterialRes.db2');
	await itemDisplayInfoMaterialRes.parse();

	const itemAppearance = new WDCReader('DBFilesClient/ItemAppearance.db2');
	await itemAppearance.parse();

	await progress.step('Building item relationships...');

	const rows = itemSparse.getAllRows();
	const items = Array<Item>();

	const appearanceMap = new Map();
	for (const row of itemModifiedAppearance.getAllRows().values())
		appearanceMap.set(row.ItemID, row.ItemAppearanceID);

	const materialMap = new MultiMap();
	for (const row of itemDisplayInfoMaterialRes.getAllRows().values())
		materialMap.set(row.ItemDisplayInfoID as number, row.MaterialResourcesID as number);

	for (const [itemID, itemRow] of rows) {
		if (ITEM_SLOTS_IGNORED.includes(itemRow.inventoryType as number))
			continue;

		const itemAppearanceID = appearanceMap.get(itemID);
		const itemAppearanceRow = itemAppearance.getRow(itemAppearanceID);

		let materials = null;
		let models = null;
		if (itemAppearanceRow !== null) {
			materials = [];
			models = [];

			const itemDisplayInfoRow = itemDisplayInfo.getRow(itemAppearanceRow.ItemDisplayInfoID as number);
			if (itemDisplayInfoRow !== null) {
				materials.push(...itemDisplayInfoRow.ModelMaterialResourcesID as Array<number>);
				models.push(...itemDisplayInfoRow.ModelResourcesID as Array<number>);
			}

			const materialRes = materialMap.get(itemAppearanceRow.ItemDisplayInfoID);
			if (materialRes !== undefined)
				Array.isArray(materialRes) ? materials.push(...materialRes) : materials.push(materialRes);

			materials = materials.filter(e => e !== 0);
			models = models.filter(e => e !== 0);
		}

		items.push(Object.freeze(new Item(itemID, itemRow, itemAppearanceRow, materials, models)));
	}

	// Show the item viewer screen.
	State.loadPct = -1;
	State.isBusy--;
	State.setScreen('tab-items');

	// Load initial configuration for the type control from config.
	const enabledTypes = State.config.itemViewerEnabledTypes;
	const mask = [];

	for (const label of Object.keys(ITEM_SLOTS_MERGED))
		mask.push({ label, checked: enabledTypes.includes(label) });

	// Register a watcher for the item type control.
	State.$watch('itemViewerTypeMask', () => {
		// Refilter the listfile based on what the new selection.
		const filter = State.itemViewerTypeMask.filter(e => e.checked);
		const mask = [];

		filter.forEach(e => mask.push(...ITEM_SLOTS_MERGED[e.label]));
		const test = items.filter(item => mask.includes(item.inventoryType));
		State.listfileItems = test;

		// Save just the names of user enabled types, preventing incompatibilities if we change things.
		State.config.itemViewerEnabledTypes = State.itemViewerTypeMask.map(e => e.label);
	}, { deep: true });

	State.itemViewerTypeMask = mask;
});