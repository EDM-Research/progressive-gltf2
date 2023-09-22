type boundingbox = {
	minx: number,
	miny: number,
	minz: number,
	maxx: number,
	maxy: number,
	maxz: number,
	translatex: number,
	translatey: number,
	translatez: number,
	rotationx: number,
	rotationy: number,
	rotationz: number,
	rotationw: number,
}

enum state {
	Todo,
	Doing,
	Done,
}

type boundingboxMap = Record<string, boundingbox>

type priorityMap = Record<string, number>
type distanceMap = Record<string, number>

type generalPoint = {
	x: number;
	y: number;
	z: number;
}

type modelHeader = any
type node = any // Node object

type config = Record<string, any>


type partition = any 
const globalConfig = 	{	
	"loadObjectsSeperately": true, 
	"loadOnlyInViewingFrustumByX" : "bb", //Options: null, "point", "bb" (bounding box)
	"amalgateRequests": true,
	"lockYCoordinate": false,
	"filterNodesIfAlreadyLoaded": true,
	"filterNodesIfAlreadyQueued": true,
	"priorityBySize":true,
	"sortRequestsBySize":true,
	"loadN":-1,
}

const DEFAULT_MOVEMENT_SPEED = 2;

//import * as THREE from 'three'
//import { FlyControls } from 'three/examples/jsm/controls/FlyControls'
//
//import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
//import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
//import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
//const  MeshoptDecoder = require('three/examples/jsm/libs/meshopt_decoder.module.js')
//import Stats from 'three/examples/jsm/libs/stats.module'
//
//// @ts-ignore
//import 'three-sixty/build/three-sixty'

import * as BABYLON from "@babylonjs/core";

import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Scene } from '@babylonjs/core/scene';

import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';

import "@babylonjs/loaders/glTF";

let locks: any = []
let locks_key: any = []

let lock_parse_count = 1;
let lock_parse_count_current = 0;
let lock_fetch_counter = 0;














//var mixer: any;
//
//const scene = new THREE.Scene()
//scene.add(new THREE.AxesHelper(5))
//
//
//const color = 0xFFFFFF;
//const intensity = 2;
//const light = new THREE.AmbientLight(color, intensity);
//
//const light2 = new THREE.DirectionalLight(color, 10);
//light2.position.set(0,40,0)
//light2.target.position.set(20,0,0)
//
//
//scene.add(light);
//scene.add(light2);
//scene.add(light2.target);
//
//const clock = new THREE.Clock();
//const camera = new THREE.PerspectiveCamera(
//	75,
//	window.innerWidth / window.innerHeight,
//	0.01,
//	4000
//)
//
//
//
//const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true})
//renderer.physicallyCorrectLights = true
//renderer.shadowMap.enabled = true
//renderer.setSize(window.innerWidth, window.innerHeight)
//document.body.appendChild(renderer.domElement)
//
////const controls = new OrbitControls(camera, renderer.domElement)
////controls.enableDamping = true
//const controls = new FlyControls( camera, renderer.domElement );
//controls.movementSpeed = DEFAULT_MOVEMENT_SPEED;
//controls.rollSpeed = Math.PI / 2;
//controls.autoForward = false;
//controls.dragToLook = true;
//
//const dracoLoader = new DRACOLoader()
//dracoLoader.setDecoderPath('js/libs/draco/')
//dracoLoader.preload()
//
//const ktx2Loader = new KTX2Loader();
//ktx2Loader.setTranscoderPath('js/libs/basis/' );
//ktx2Loader.detectSupport( renderer );
//
//const gltfLoader = new GLTFLoader()
//gltfLoader.setDRACOLoader(dracoLoader)
//gltfLoader.setKTX2Loader(ktx2Loader)
//gltfLoader.setMeshoptDecoder(MeshoptDecoder)

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const urlModel = urlParams.get('model')

const X = Number(urlParams.get('x'))
const Y = Number(urlParams.get('y'))
const Z = Number(urlParams.get('z'))

//camera.position.x = X
//camera.position.y = Y
//camera.position.z = Z
//const lockY = camera.position.y


//document.addEventListener('keydown', (e) => {
//	if (e.shiftKey)
//		controls.movementSpeed *= 10
//	if (controls.movementSpeed > 2000)
//		controls.movementSpeed = 2000
//})
//
//document.addEventListener('keydown', (e) => {
//	if (e.ctrlKey)
//		controls.movementSpeed /= 10
//	if (controls.movementSpeed < 2)
//		controls.movementSpeed = 2
//})



// 1 sherpa per remote file because of the way how buffers and headers are handled!
class Sherpa {

	// @ts-ignore
	private _totalSize: number;
	private _jsonSize: number;
	private _bufferSize: number;
	private _chunk1: ArrayBuffer;
	private _packInit: boolean;
	private _modelUrl: string;
	private _fullJSONHeader: modelHeader;
	private _globalBoundingBoxMap:boundingboxMap;
	//private _bbSizeCache: numberMap;
	private _bufferViewPromiseArray: Array<Promise<void>>;
	private _bufferViewPromiseResolver: Array<(value: unknown)=>void>;
	private _bufferViewPromiseStateArray:  Array<number>;
	private _modelState: any;
	//private _meshNameIndexMap: any;
	private _partitions_metadata: Record<string, partition>;
	public promiseCounter: number;

	private _sizeToDo: number;

	private _bufferViewReferenceCount: Array<Array<any>>;

	constructor(modelUrl: string) {
		this._modelUrl = modelUrl
		this._jsonSize = -1;
		this._totalSize =  -1;
		this._bufferSize = -1;
		this._chunk1 = new ArrayBuffer(0);
		this._packInit = false;
		this._fullJSONHeader = {};
		this._globalBoundingBoxMap = {};
		//this._bbSizeCache = {};
		this.promiseCounter = 0;

		this._bufferViewPromiseArray = [];
		this._bufferViewPromiseResolver = [];
		this._bufferViewPromiseStateArray = [];

		this._bufferViewReferenceCount = [];

		this._modelState = {};

		//this._meshNameIndexMap = {};
		this._partitions_metadata = {};
		this._sizeToDo = -1;
	}



	// Mapping of boundingboxes to their respective nodes
	getGlobalBoundingBoxMap() {
		return this._globalBoundingBoxMap;
	}

	getModelsToLoad() {
		const out = [];
		for (const key in this._modelState){
			if (this._modelState[key] === state.Todo) 
				out.push(key);
		}
		return out
	}

	addToQueue(inpName: string):void {
		this._modelState[inpName] = state.Doing
	}

	flagModelLoaded(inpName: string):void {
		this._modelState[inpName] = state.Done
	}


	checkModelLoaded(inpName: string): boolean{
		return this._modelState[inpName] === state.Done;
	}


	getModelLoadedCount(): number{
		let out = 0
		for (const key in this._modelState){
			if (this._modelState[key] === state.Done) 
				out++;
		}
		return out
	}

	getModelNotLoadedCount(): number{
		let out = 0
		for (const key in this._modelState){
			if (this._modelState[key] !== state.Done) 
				out++;
		}
		return out
	}

	getSizeToLoad() {
		return this._sizeToDo;
	}

	getModelHeader() {
		return this._fullJSONHeader;
	}

	// Get's only run once!
	async initPack(): Promise<void> {
		if (!this._packInit) { // Singleton-ish

			await this._getHeader();
			await this._getModelHeaderAndBufferSize();

			this._sizeToDo = this._bufferSize;
			this._chunk1 = new ArrayBuffer(this._bufferSize+8)
			const dv = new DataView(this._chunk1)
			dv.setUint32(0, this._bufferSize, true) //size
			dv.setUint32(4, 5130562, true) //BIN
			this._packInit = true;

			this.makePartitions();  // Probably maximally optimized
			this.fillGlobalMaps(); // Probably maximally optimized

			for (let i = 0; i < this._bufferViewReferenceCount.length; i++){
				let x = this._bufferViewReferenceCount[i].length
				if (x > 1)
					continue
					//console.log(i, x, this._fullJSONHeader["bufferViews"][i]["byteLength"], "\tscore:",  x/this._fullJSONHeader["bufferViews"][i]["byteLength"])
			}

			//console.log(this._bufferViewReferenceCount)


			for (let i = 0; i < this._fullJSONHeader["bufferViews"].length; i++){
				this._bufferViewPromiseStateArray[i] = state.Todo;
				this._bufferViewPromiseArray[i] = new Promise((resolve) => {
					this._bufferViewPromiseResolver[i] = resolve;
				}).then( () => {
				    this._bufferViewPromiseStateArray[i] = state.Done;
					this._sizeToDo -= this._fullJSONHeader["bufferViews"][i]["byteLength"]
				});
			}
			console.log("initPack;", performance.now());
		}
	}

	// Gets run once!
	async fillGlobalMaps(): Promise<void> {
		this._fullJSONHeader["nodes"].forEach((node: node) => {
			const nodeName = node["name"]



			if (!node.hasOwnProperty('children') && node.hasOwnProperty('name') && node.hasOwnProperty('mesh'))
				this._modelState[nodeName] = state.Todo;

			let partition_metadata = this._partitions_metadata[nodeName]
			const modelHeader = this._fullJSONHeader;

			if (partition_metadata === undefined)
				return

			let mins:number[] = []
			let maxs:number[] = []
			let scales:number[] = []
			let rotations:number[] = []
			let translations:number[] = []


			partition_metadata["accessors"].forEach((index: number) => {
				if (modelHeader["accessors"][index]["min"])
					mins = modelHeader["accessors"][index]["min"]

				if (modelHeader["accessors"][index]["max"])
					maxs = modelHeader["accessors"][index]["max"]
			});


			if (node.hasOwnProperty("scale")){
				scales = node["scale"]
			} else {
				scales = [1,1,1]
			}

			if (node.hasOwnProperty("rotation")){
				rotations = node["rotation"]
			} else {
				rotations = [0,0,0,0]
			}

			if (node.hasOwnProperty("translation")){
				translations = node["translation"]
			} else {
				translations = [0,0,0]
			}


			let bb:boundingbox = { 
				minx: mins[0] * scales[0],
				miny: mins[1] * scales[1],
				minz: mins[2] * scales[2],

				maxx: maxs[0] * scales[0],
				maxy: maxs[1] * scales[1],
				maxz: maxs[2] * scales[2],

				translatex: translations[0],
				translatey: translations[1],
				translatez: translations[2],

				rotationx: rotations[0],
				rotationy: rotations[1],
				rotationz: rotations[2],
				rotationw: rotations[3],
				
			}



			this._globalBoundingBoxMap[node["name"]] = bb
		})

	}

	// Wrapper so getByteRange can work with the promiseCacheMap
	async getByteRange(byteOffset: number, byteLength: number, tagName: string = "", priority: number=1, exclusive: number=0): Promise<ArrayBuffer> {
		return this.getByteRangeWrapper(byteOffset, byteLength, tagName, priority, exclusive)
	}


	// Calculates the multi-part partial header string 
	// Internal function
	genRangeString(indexes: number[]): string {
		let ranges: number[][] = [];

		indexes.forEach((index: number) => {
			ranges.push([this._fullJSONHeader["bufferViews"][index]["byteOffset"], this._fullJSONHeader["bufferViews"][index]["byteOffset"]+this._fullJSONHeader["bufferViews"][index]["byteLength"]]);
		});

		indexes.sort((a:number,b:number) => a - b)

		const sequences: [number, number][] = [];

		for (let i = 0; i < indexes.length; i++) {
			const start = indexes[i];
			let end = start;

			while (indexes[i + 1] === end + 1) {
				end++;
				i++;
			}

			if (start !== end) {
				sequences.push([start, end]);
			} else {
				sequences.push([start, start]);
			}

		}
	
		return sequences.map((r: number[]) => `${this._jsonSize+28+this._fullJSONHeader["bufferViews"][r[0]]["byteOffset"]}-${this._jsonSize+28+this._fullJSONHeader["bufferViews"][r[1]]["byteOffset"]+this._fullJSONHeader["bufferViews"][r[1]]["byteLength"]-1}`).join(",")
	}



	// Removes indexes that do not have state: "Todo"
	// Mark other indexes as Doing
	// This function makes sure we do not download the same bufferview twice
	cleanIndexes(indexes: number[]): number[] {
		let indexRemoval: number[] = []
		indexes.forEach((item:number) => {
			if (!(this._bufferViewPromiseStateArray[item] === state.Todo)){ //todo = 0, doing=1, done =2
				indexRemoval.push(item);
			}
			this._bufferViewPromiseStateArray[item] = state.Doing;
		});

		return indexes.filter((item: number) => {return !indexRemoval.includes(item);})

	}

	parseResponse(boundary: string, ab: ArrayBuffer): void {
		const u8 = new Uint8Array(ab);
		const chunk1 = new Uint8Array(this._chunk1)

		let currentCounter = 0;
		let inData = true;


		let currentStartOfHeader = -1;
		let currentStartOfData = -1;
		let currentRange = ""

		let byteLength = -1;
		let start = -1;
		let end = -1;
		const decoder = new TextDecoder()


		// Loop once over data, we are either looking for \r\n\r\n or the boundary --<string> 
		// If we are not inData, check for \r\n\r\n, parse the bytes and jump that many bytes further, keeping track of where the data starts
		// if we are inData, check wether we find the boundary, then copy from the start of the data, to where the beginning of the boundary is!
		for (let i = 0; i < u8.length; i++){
			if(inData){
				if(u8[i] === boundary.charCodeAt(currentCounter)){
					currentCounter++;
					if (currentCounter === boundary.length){
						if (currentRange !== ""){
							chunk1.set(u8.slice(currentStartOfData, i-(boundary.length+1)), 8+start-(this._jsonSize+28))
						}
						currentCounter = 0;
						i+=3
						inData = false;
						currentStartOfHeader = i;
					}
				} else {
					currentCounter = 0;
				}
			} else {
				if (u8[i] === 0x0d && u8[i+1] === 0x0a && u8[i+2] === 0x0d && u8[i+3] === 0x0a){
					currentRange = decoder.decode(ab.slice(currentStartOfHeader, i));
					const regexResult = /bytes (\d+)-(\d+)/.exec(currentRange);
					if (regexResult !== null) {
						const [, startString, endString] = regexResult;
						start = parseInt(startString, 10);
						end = parseInt(endString, 10);
						byteLength = end-start;
					}
					i+=4
					inData = true;
					currentStartOfData = i;
					i+=byteLength; // Jump safely ahead over all data, this allows for major speedup!
				}
			}

		}

	}


	// Fecthes the data using a multi-part partial GET request and places them into the correct spots in the local databuffer
	async getMultiPartByteRange(indexes: number[], config:config): Promise<void> {

		indexes = this.cleanIndexes(indexes);



		// If there are no indexes to load, return early from this function
		if (indexes.length === 0)
			return

		// Generate the ranges trign for the "Range" header
		const rangestrings = this.genRangeString(indexes)


		// Build the header and issue the fetch
		const url = "models/"+this._modelUrl;
		const headers = new Headers();
		headers.append('Range', `bytes=${rangestrings}`);
		headers.append('Accept', 'multipart/byteranges');
		const response = await fetch(url, {headers});
		if (!response.ok) {
			throw new Error(`Failed to fetch byte ranges: ${response.statusText}`);
		}

		// Find "boundary" in response header
		// This boundary is used to parse the multi-part byte range response to split up the different parts of the data
		const boundary_part = response.headers.get('Content-Type')?.split('=')[1];
		const boundary = "--" + boundary_part


		// Wait till the request has fully come in
		const ab = await response.arrayBuffer()


		// Dispatch event that the fetch has been completed, thus the network pipe is clear
		document.dispatchEvent(new CustomEvent("fetchDone", {detail: {config:config}})) // Technically fetch is done here!



		locks[lock_fetch_counter].then(() => { 
			
			// If there is no boundary, the range was one continuous and thus copy can happen at once
			// If there is boundaries, the ranges need to be copied into the correct place
			if (boundary_part === undefined){
				const u8 = new Uint8Array(ab);
				new Uint8Array(this._chunk1, 8+this._fullJSONHeader["bufferViews"][indexes[0]]["byteOffset"] ).set(u8)
			} else { // Multi range case
				this.parseResponse(boundary, ab);
			}


			// defer the promises
			// This marks the promises as resolved, allows multiple objects to wait for the same promise
			for (let i = 0; i < indexes.length; i++){
				this._bufferViewPromiseResolver[indexes[i]](null);
			}


		} );
		lock_fetch_counter++;

	}


	// Creates the new .glb file in memory
	//@ts-ignore
	async prepareMultiPack(jsonBytes: any, inpNames: string[],  priorityMap: priorityMap = {}, config: config): Promise<ArrayBuffer|null> {
		let sum: string = "sum_" + inpNames.join('');

		// Get pre-calcualted indexes
		let indexes: number[] = this._partitions_metadata[sum]["bufferViews"];

		this.getMultiPartByteRange(indexes, config);


		// Link promises to this .glb file call
		let promises:Array<Promise<void>> = [];
		for (let i = 0; i < indexes.length; i++){
			promises.push(this._bufferViewPromiseArray[indexes[i]]);
		}

		// Wait for all promises to be done
		return Promise.all(promises).then(() => {
			let bufferSize = this._bufferSize; 

			//let utf8Encode = new TextEncoder();
			//let jsonBytes = utf8Encode.encode(JSON.stringify(preparedJson))
			let _pack = new ArrayBuffer(20+jsonBytes.length+this._chunk1.byteLength)//+16) 

			// Prepare the new ArrayBuffer with the necessary values
			const dv = new DataView(_pack)
			dv.setUint32(0, 1179937895, true) // Magic number: gltf
			dv.setUint32(4, 2, true) //Magic number: version 2
			dv.setUint32(8, jsonBytes.length+bufferSize+28, true) //total size 28 bytes fixed, new json bytes size and buffer size
			dv.setUint32(12, jsonBytes.length, true) // json bytes size
			dv.setUint32(16, 1313821514, true) //Magic number: JSON
			new Uint8Array(_pack,20).set(jsonBytes)

			new Uint8Array(_pack, 20+jsonBytes.length).set(new Uint8Array(this._chunk1)) // Copy the entire chunk1 (seems faster than copying by indexes)

			return _pack
		})

	}




	// Get single byterange
	async getByteRangeWrapper(byteOffset: number, byteLength: number, tagName: string = "", priority: number=1, exclusive: number=0): Promise<ArrayBuffer> {
		if (!isNaN(byteOffset) && !isNaN(byteLength)){
			return fetch("models/"+this._modelUrl, {
				headers:{
					'Range': 'bytes='+byteOffset.toString()+'-'+(byteOffset+byteLength-1).toString(),
					'edm-prio': priority.toString(),
					'edm-excl': exclusive.toString(),
					'edm-name': tagName
				}
			}).then((res:Response) => { return res.arrayBuffer()});

		} else {
			return Promise.reject(new Error('invalid byteRange'))
		}
	}

	async _getHeader() {
		const byteRange = await this.getByteRange(0, 20, "header", 1);
		const dv = new DataView(byteRange)
		this._jsonSize = dv.getUint32(12, true)
		this._totalSize = dv.getUint32(8, true)
		
	}

	async _getModelHeaderAndBufferSize(): Promise<void> {
		const byteRange = await this.getByteRange(20, this._jsonSize+4, "modelheader");
		this._fullJSONHeader= JSON.parse(new TextDecoder().decode(byteRange.slice(0,this._jsonSize)));
		this._bufferSize = new DataView(byteRange.slice(this._jsonSize, this._jsonSize+4)).getUint32(0, true);
	}


	makePartitions() {

		const modelHeader = this._fullJSONHeader;
		let partitions_metadata: any = this._partitions_metadata;


		// Generate a sub-glTF object for every node 
		modelHeader["nodes"].forEach((node: any, index: number) => {

			if (!node.hasOwnProperty('mesh'))
				return	

			let nodeName = node["name"]
			partitions_metadata[nodeName] = {}
			let partition_metadata = partitions_metadata[nodeName]

			partition_metadata["nodes"] = [] 
			partition_metadata["nodes"].push(index)

			// Initialise rest of metadata lists
			partition_metadata["materials"] = []
			partition_metadata["meshes"] = []
			partition_metadata["textures"] = []
			partition_metadata["images"] =  []
			partition_metadata["accessors"] = []
			partition_metadata["bufferViews"] = []


			partition_metadata["meshes"].push(node["mesh"])

			modelHeader["meshes"][node["mesh"]]["primitives"].forEach((primitive: any) => { // generally small and non repetitive
				//TODO fix ts-ignores
				// @ts-ignore
				for (let [key, value] of Object.entries(primitive["attributes"])){

					partition_metadata["accessors"].push(value)

					// @ts-ignore
					if (modelHeader["accessors"][value]["bufferView"] !== undefined){
						// @ts-ignore
						partition_metadata["bufferViews"].push(modelHeader["accessors"][value]["bufferView"]);
					}	
				}


				if (primitive.hasOwnProperty("extensions") && primitive["extensions"].hasOwnProperty("KHR_draco_mesh_compression")){

					// @ts-ignore
					for (let [key, value] of Object.entries(primitive["extensions"]["KHR_draco_mesh_compression"]["attributes"])){

						partition_metadata["accessors"].push(value)
						// @ts-ignore
						if (modelHeader["accessors"][value]["bufferView"] !== undefined){
							// @ts-ignore
							partition_metadata["bufferViews"].push(modelHeader["accessors"][value]["bufferView"])
						}
					}

					partition_metadata["bufferViews"].push(primitive["extensions"]["KHR_draco_mesh_compression"]["bufferView"])

				}

				partition_metadata["accessors"].push(primitive["indices"])
				if ( modelHeader["accessors"][primitive["indices"]]["bufferView"] !== undefined)
					partition_metadata["bufferViews"].push(modelHeader["accessors"][primitive["indices"]]["bufferView"])


					if (primitive.hasOwnProperty("material")){
						partition_metadata["materials"].push(primitive["material"])




						if (modelHeader["materials"][primitive["material"]].hasOwnProperty("pbrMetallicRoughness") && modelHeader["materials"][primitive["material"]]["pbrMetallicRoughness"].hasOwnProperty("baseColorTexture")){
							partition_metadata["textures"].push(modelHeader["materials"][primitive["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"])
						}

						if (modelHeader["materials"][primitive["material"]].hasOwnProperty("pbrMetallicRoughness") && modelHeader["materials"][primitive["material"]]["pbrMetallicRoughness"].hasOwnProperty("metallicRoughnessTexture")){
							partition_metadata["textures"].push(modelHeader["materials"][primitive["material"]]["pbrMetallicRoughness"]["metallicRoughnessTexture"]["index"])
						}

						if (modelHeader["materials"][primitive["material"]].hasOwnProperty("normalTexture")){
							partition_metadata["textures"].push(modelHeader["materials"][primitive["material"]]["normalTexture"]["index"])
						}

						if (modelHeader["materials"][primitive["material"]].hasOwnProperty("occlusionTexture")){
							partition_metadata["textures"].push(modelHeader["materials"][primitive["material"]]["occlusionTexture"]["index"])
						}

						if (modelHeader["materials"][primitive["material"]].hasOwnProperty("emissiveTexture")){
							partition_metadata["textures"].push(modelHeader["materials"][primitive["material"]]["emissiveTexture"]["index"])
						}
					}

				partition_metadata["textures"].forEach((textureIndex: number) => {
					const imageIndex = modelHeader["textures"][textureIndex]["source"];
					partition_metadata["images"].push(imageIndex);

					const bufferViewIndex = modelHeader["images"][imageIndex]["bufferView"];
					//partition_metadata["bufferViews"].push(bufferViewIndex); // Disable this to not download colors
				});

				
			});

			//console.log(partition_metadata["bufferViews"])

			//partition_metadata["bufferViews"].forEach((bv: number) => {
			//	console.log(this._bufferViewReferenceCount[bv])
			//	if (this._bufferViewReferenceCount[bv] === undefined)
			//		this._bufferViewReferenceCount[bv] = [nodeName]
			//	else
			//		this._bufferViewReferenceCount[bv].push(nodeName)
			//});


		})

		console.log(this._bufferViewReferenceCount)

	}



	newPartitions(inpNames: string[]) : any {

		let sum: string = "sum_" + inpNames.join('');
		this._partitions_metadata[sum] = {}
		const modelHeader = this._fullJSONHeader;
		let partition_metadata = this._partitions_metadata[sum]


		let treeNodes = ["nodes","bufferViews"]

		treeNodes.forEach((treeNode: string) => {
			if (modelHeader[treeNode] === undefined)
				return

			partition_metadata[treeNode] = [] 
			inpNames.forEach((nodeName: string) => {
				this._partitions_metadata[nodeName][treeNode].forEach((obj: number) => {
					partition_metadata[treeNode].push(obj);
				});
			});

			partition_metadata[treeNode] = [...new Set(partition_metadata[treeNode])]
		});


		if(1){
		treeNodes = ["materials","textures", "images"]

		treeNodes.forEach((treeNode: string) => {
			if (modelHeader[treeNode] === undefined)
				return

			partition_metadata[treeNode] = [] 
			inpNames.forEach((nodeName: string) => {
				this._partitions_metadata[nodeName][treeNode].forEach((obj: number) => {
					modelHeader[treeNode][obj] = {}
				});
			});

			partition_metadata[treeNode] = [...new Set(partition_metadata[treeNode])]
		});
		}




		this._fullJSONHeader["scenes"].push({"name":sum, "nodes": partition_metadata["nodes"]})

		this._fullJSONHeader["scene"] = this._fullJSONHeader["scenes"].length-1

		let utf8Encode = new TextEncoder();
		let jsonBytes = utf8Encode.encode(JSON.stringify(this._fullJSONHeader))
		return jsonBytes
	}



}


let camera:any = null;


const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element
    const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

    // Disable loading screen
    BABYLON.SceneLoader.ShowLoadingScreen = false;

    // Add your code here matching the playground format
    const createScene = () => {
        const scene = new BABYLON.Scene(engine);
        // Install gravity in the scene (e.g., prevent upward camera movement)
        // !!! NOTE: gravity is currently disabled (i.e., set to 0) !!!
        scene.gravity = new BABYLON.Vector3(0, 0, 0);

        //BABYLON.MeshBuilder.CreateBox("box", {});

        // glTF Files use right handed system 
        scene.useRightHandedSystem = true;

        camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 1, 0), scene);
        camera.attachControl(canvas, true);
        
        // Set ellipsoid around the camera (i.e., represent human size)
        camera.ellipsoid = new BABYLON.Vector3(1, 2, 1);

        // Enable scene collisions
        scene.collisionsEnabled = true;

        // Apply collisions and gravity to the active camera
        camera.checkCollisions = true;
        camera.applyGravity = true;

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
     return scene;
    };

    const scene = createScene(); // Call the createScene function

    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(() => {
        scene.render();
    });


 window.addEventListener("resize", () => {
        engine.resize();
    });














// Gets run for every object
// @ts-ignore
function loadFancy(inpNames: string[], currentDistanceMap: distanceMap, sherpa: any, config: config): void{
	if (inpNames.length > 0){
		let jsonBytes = sherpa.newPartitions(inpNames) // Could be cached


		let x = new Promise((resolve) => {
			//console.log(lock_parse_count_current)
			locks_key[lock_parse_count_current] = resolve;
			lock_parse_count_current++
			
		})
			//.then( () => {
			////console.log("lock", lock_parse_count, "resolved");
			//});
		locks.push(x)

		locks_key[0]()
		//TODO check if this does anything
		//locks_key[lock_parse_count_current-1]() 

		//console.log("before parse", locks, locks_key, lock_fetch_counter)
		
		sherpa.prepareMultiPack(jsonBytes, inpNames, [], config).then((pack: ArrayBuffer|null) => {
			if (pack !== null){
				const u8 = new Uint8Array(pack)
				//console.log(performance.now(), "gltf parsing", inpNames.length, "this means the fetch has also been completely parsed")
				//gltfLoader.parse(pack, "", gltf_callback, gltf_error);
				const blob: Blob = new Blob([u8]);
				const url: string = URL.createObjectURL(blob);
				BABYLON.SceneLoader.AppendAsync(url, undefined, scene, undefined, ".glb")
						.then(() => {
							document.dispatchEvent(new CustomEvent("modelLoaded", {detail: {inpNames:inpNames, config:config}}))

							if (typeof locks_key[lock_parse_count] === "function" )
								locks_key[lock_parse_count]()
							//console.log("after parse", locks, lock_fetch_counter, lock_fetch_counter)
							lock_parse_count++

						})


					// .then((scene) => {
					//     // Make all meshes in the loaded scene collisionable
					//     scene.meshes.forEach((mesh) => { 
					//         mesh.checkCollisions = true;
					//     });
					// })
					.catch((err) => {
						console.log(`Adding glb sub-mesh to scene failed with error "${err}"`);
					});
						}
					})



	}
}

let firstLoaded = false
let fovDone = false

const lazy = Number(urlParams.get('l'))
const instant = Number(urlParams.get('i'))


if (lazy && urlModel?.includes('glb')){
	console.log("Starting;", performance.now())
	//loadModel("models/"+urlModel)

} else if (urlModel?.includes('glb')) {
	console.log("Starting;", performance.now())
	let sandy = new Sherpa(urlModel);
	sandy.initPack().then( () => {

		document.addEventListener('queueLoad', (e: any) => {
			const currentDistanceMap = calculateDistanceMap(sandy, {x:camera.position._x,y:camera.position._x,z:camera.position._x})//TODO fix with actual camera input

			let config = e.detail["config"]
			let sortedNodes = modifyNodes(camera, currentDistanceMap, sandy, config ); //TODO fix with actual camera input

			sortedNodes.forEach((a: string) => { sandy.addToQueue(a) })


			if ((sortedNodes.length) === 0) {
				if (config["loadOnlyInViewingFrustumByX"] === "bb") {
					console.log("Switching;", performance.now());
					config["loadOnlyInViewingFrustumByX"] = "null"
					document.dispatchEvent(new CustomEvent("queueLoad", {detail: {config:config}}))   // Redo the calculation, since no nodes still had to be loaded
				}
			} else {
				//console.log(performance.now(),"This is before dispatchingLoading #",sortedNodes.length, "this also means the previous fetch (if there were any) is done downloading")
				dispatchLoading(sortedNodes, currentDistanceMap, sandy, config);
			}
		})

		document.addEventListener('fetchDone', (e: any) => {
			let config = e.detail["config"]
			config["loadN"] = Math.round(config["loadN"]*config["M"])
			document.dispatchEvent(new CustomEvent("queueLoad", {detail: {config:config}}))   // fetch was done
		});

		document.addEventListener('modelLoaded', (e: any) => {
			console.log("Loaded;", performance.now(), "; size;", sandy.getSizeToLoad());
			if (!firstLoaded)
				firstLoaded=true
				//console.log("First;", performance.now(), "; size;", sandy.getSizeToLoad());
			
			if (e.detail["config"]["loadOnlyInViewingFrustumByX"] !== "bb" && !fovDone) {
				console.log("FOV;", performance.now(), "; size;", sandy.getSizeToLoad());
				fovDone = true;
			}

			if (sandy.getModelNotLoadedCount() === 0)
				console.log("done!;", performance.now(), "; size;", sandy.getSizeToLoad());

			firstLoaded=true
		})


		if (instant){
			const config = 	{	
				"loadObjectsSeperately": false, 
				"loadOnlyInViewingFrustumByX" : "bb", //Options: null, "point", "bb" (bounding box)
				"sortRequestsByDistance": true,
				"filterNodesIfAlreadyLoaded": true,
				"filterNodesIfAlreadyQueued": true,
				"priorityByDistance": true, 
				"priorityBySize":true,
				"sortRequestsBySize":true,
				"loadN":Number(urlParams.get('n')),
				"M":Number(urlParams.get('m')),
			}
			console.log("Instant;", performance.now())
			document.dispatchEvent(new CustomEvent("queueLoad", {detail: {config:config}}))
		}






	})
}




function modifyNodes(camera: any, distanceMap:distanceMap, sherpa: any, config:config): string[] {
	let nodesList: string[] = [...sherpa.getModelsToLoad()];

	if (config["loadOnlyInViewingFrustumByX"] === "bb") nodesList = nodesList.filter(function(m:string) {return checkInBB(sherpa.getGlobalBoundingBoxMap()[m], camera)});
	//if (config["loadOnlyInViewingFrustumByX"] === "point") nodesList = nodesList.filter(function(m:string) {return checkByPoint(obj,camera)});

	if (config["sortRequestsByDistance"]) nodesList.sort(function(a: string, b: string){return distanceMap[a]-distanceMap[b]})
	//if (config["sortRequestsBySize"]) nodesList.sort(function(a: string, b: string){return sherpa._bbSizeCache[b["name"]]-sherpa._bbSizeCache[a["name"]]})

	if (config["loadN"] !== -1) nodesList = nodesList.slice(0,config["loadN"]);

	return nodesList
}


function dispatchLoading(nodesList: string[], distanceMap:distanceMap, sherpa: any, config: config) {
	if (config["loadObjectsSeperately"]){
		nodesList.forEach((m: string)  => {
			 loadFancy([m], distanceMap, sherpa, config);
		})
	}
	else
		loadFancy(nodesList, distanceMap, sherpa, config);
}










// Calculates the distance for all unloaded nodes 
function calculateDistanceMap(sherpa:any, origin:generalPoint): distanceMap {

	let currentDistanceMap: distanceMap = {}
	const modelHeader = sherpa.getModelHeader()

	modelHeader["nodes"].forEach((node: node) => {
		if (!sherpa.checkModelLoaded(node["name"])){
			currentDistanceMap[node["name"]] = calculateDistance(node, origin);
		}

	})
	return currentDistanceMap;


}


// Calculates distance between model and point
function calculateDistance(node:node, origin: generalPoint):number{
	let x,y,z

	if (node.hasOwnProperty("translation")){
		x = node["translation"][0]
		y = node["translation"][1]
		z = node["translation"][2]
	} else {
		x = 0;	
		y = 0;	
		z = 0;	
	}

	let dx = x-origin.x;
	let dy = y-origin.y;
	let dz = z-origin.z;

	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}


function checkInBB(bb: boundingbox, camera:any){

	// Get the positions of the cube's opposite corners
	//
	//
	//
	let corners = calculateNewCubeCorners(
		{x:bb["minx"], y:bb["miny"], z:bb["minz"]}, 
		{x:bb["maxx"], y:bb["maxy"], z:bb["maxz"]}, 
		{x:bb["translatex"],y:bb["translatey"],z:bb["translatez"]},
		{x:bb["rotationx"],y:bb["rotationy"],z:bb["rotationz"], w:bb["rotationw"]})
	let corner1 = new BABYLON.Vector3(corners[0].x, corners[0].y, corners[0].z); // First corner coordinates
	let corner2 = new BABYLON.Vector3(corners[1].x, corners[1].y, corners[1].z); // Opposite corner coordinates

	// Create a bounding box around the cube
	let boundingBox = new BABYLON.BoundingBox(corner1, corner2);

	let isCubeInView = camera.isInFrustum(boundingBox)


	return isCubeInView;
/*	const frustum = new THREE.Frustum();
	frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));


	let box = new THREE.Box3(new THREE.Vector3(bb["minx"], bb["miny"], bb["minz"]), new THREE.Vector3(bb["maxx"], bb["maxy"], bb["maxz"]));

	let q = new THREE.Quaternion().fromArray([bb["rotationx"], bb["rotationy"],bb["rotationz"],bb["rotationw"]])
	let rot = new THREE.Matrix4().makeRotationFromQuaternion(q)
	box.applyMatrix4(rot)
	box.translate(new THREE.Vector3(bb["translatex"],bb["translatey"],bb["translatez"]))


	// Show randomly colored bounding box
	if (0){
		const r = Math.random()
		const g = Math.random()
		const b = Math.random()
		const helper = new THREE.Box3Helper(box, new THREE.Color(r,g,b));
		scene.add(helper)
	}




	return frustum.intersectsBox(box);
	//return {check: frustum.intersectsBox(box), f: frustum}
	*/
}


/*
//@ts-ignore
function checkByPoint(a: any, camera:any){
	const frustum = new THREE.Frustum();
	frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	let point;
	try { point = new THREE.Vector3(a["translation"][0],a["translation"][1],a["translation"][2]); } catch (error) { console.log(error); point = new THREE.Vector3(0,0,0); } //Default to 0 if no translation

	return frustum.containsPoint(point)
}
*/


interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function scaleVec3(v: Vec3, scalar: number): Vec3 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  };
}

function normalizeVec3(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length !== 0) {
    const invLength = 1 / length;
    return scaleVec3(v, invLength);
  } else {
    return { x: 0, y: 0, z: 0 };
  }
}

function multiplyQuat(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function transformQuat(v: Vec3, q: Quat): Vec3 {
  const x = q.x;
  const y = q.y;
  const z = q.z;
  const w = q.w;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx2 = x * x2;
  const xy2 = x * y2;
  const xz2 = x * z2;
  const yy2 = y * y2;
  const yz2 = y * z2;
  const zz2 = z * z2;
  const wx2 = w * x2;
  const wy2 = w * y2;
  const wz2 = w * z2;
  return {
    x: (1 - yy2 - zz2) * v.x + (xy2 - wz2) * v.y + (xz2 + wy2) * v.z,
    y: (xy2 + wz2) * v.x + (1 - xx2 - zz2) * v.y + (yz2 - wx2) * v.z,
    z: (xz2 - wy2) * v.x + (yz2 + wx2) * v.y + (1 - xx2 - yy2) * v.z,
  };
}

function calculateNewCubeCorners(corner1: Vec3, corner2: Vec3, translation: Vec3, rotation: Quat): Vec3[] {
  // Step 1: Calculate center point
  const center: Vec3 = scaleVec3(addVec3(corner1, corner2), 0.5);

  // Step 2: Get relative corner positions
  const relativeCorner1: Vec3 = subtractVec3(corner1, center);
  const relativeCorner2: Vec3 = subtractVec3(corner2, center);

  // Step 3: Apply rotation to relative corner positions
  const rotatedCorner1: Vec3 = transformQuat(relativeCorner1, rotation);
  const rotatedCorner2: Vec3 = transformQuat(relativeCorner2, rotation);

  // Step 4: Add translation to rotated corner positions
  const translatedRotatedCorner1: Vec3 = addVec3(rotatedCorner1, translation);
  const translatedRotatedCorner2: Vec3 = addVec3(rotatedCorner2, translation);

  // Step 5: Add center point back to translated and rotated corner positions
  const newCorner1: Vec3 = addVec3(translatedRotatedCorner1, center);
  const newCorner2: Vec3 = addVec3(translatedRotatedCorner2, center);

  return [newCorner1, newCorner2];
}





