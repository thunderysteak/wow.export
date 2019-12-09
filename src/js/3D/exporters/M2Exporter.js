const core = require('../../core');
const log = require('../../log');

const BLPFile = require('../../casc/blp');
const M2Loader = require('../loaders/M2Loader');
const OBJWriter = require('../writers/OBJWriter');
const MTLWriter = require('../writers/MTLWriter');
const GeosetMapper = require('../GeosetMapper');
const ExportHelper = require('../../casc/export-helper');

class M2Exporter {
	/**
	 * Construct a new M2Exporter instance.
	 * @param {BufferWrapper}
	 */
	constructor(data) {
		this.m2 = new M2Loader(data);
	}

	/**
	 * Set the mask array used for geoset control.
	 * @param {Array} mask 
	 */
	setGeosetMask(mask) {
		this.geosetMask = mask;
	}

	/**
	 * Export the M2 model as a WaveFront OBJ.
	 * @param {string} out
	 * @param {boolean} exportCollision
	 */
	async exportAsOBJ(out, exportCollision = false) {
		await this.m2.load();
		const skin = await this.m2.getSkin(0);

		const obj = new OBJWriter(out);
		const mtl = new MTLWriter(ExportHelper.replaceExtension(out, '.mtl'));

		log.write('Exporting M2 model %s as OBJ: %s', this.m2.name, out);

		// Use internal M2 name for object.
		obj.setName(this.m2.name);

		// Verts, normals, UVs
		obj.setVertArray(this.m2.vertices);
		obj.setNormalArray(this.m2.normals);
		obj.setUVArray(this.m2.uv);

		// Textures
		const validTextures = {};
		for (const texture of this.m2.textures) {
			const texFileDataID = texture.fileDataID;
			if (texFileDataID > 0) {
				try {
					const data = await core.view.casc.getFile(texFileDataID);
					const blp = new BLPFile(data);

					const texFile = texFileDataID + '.png';
					const texPath = path.join(path.dirname(out), texFile);

					log.write('Exporting M2 texture %d -> %s', texFileDataID, texPath);
					await blp.saveToFile(texPath, 'image/png', true);

					mtl.addMaterial(texFileDataID, texFile);
					validTextures[texFileDataID] = true;
				} catch (e) {
					log.write('Failed to export texture %d for M2: %s', texFileDataID, e.message);
				}
			}
		}

		// Faces
		for (let mI = 0, mC = skin.submeshes.length; mI < mC; mI++) {
			// Skip geosets that are not enabled.
			if (this.geosetMask && !this.geosetMask[mI].checked)
				continue;

			const mesh = skin.submeshes[mI];
			const verts = new Array(mesh.triangleCount);
			for (let vI = 0; vI < mesh.triangleCount; vI++)
				verts[vI] = skin.indicies[skin.triangles[mesh.triangleStart + vI]];

			const texUnit = skin.textureUnits.find(tex => tex.skinSectionIndex === mI);
			const texture = this.m2.textures[this.m2.textureCombos[texUnit.textureComboIndex]];

			let matName;
			const texFileDataID = texture.fileDataID;
			if (texture && texFileDataID > 0 && validTextures[texFileDataID])
				matName = texFileDataID;

			obj.addMesh(GeosetMapper.getGeosetName(mI, mesh.submeshID), verts, matName);
		}

		await obj.write();
		await mtl.write();

		if (exportCollision) {
			const phys = new OBJWriter(ExportHelper.replaceExtension(out, '.phys.obj'));
			phys.setVertArray(this.m2.collisionPositions);
			phys.setNormalArray(this.m2.collisionNormals);
			phys.addMesh('Collision', this.m2.collisionIndicies);

			await phys.write();
		}
	}
}

module.exports = M2Exporter;