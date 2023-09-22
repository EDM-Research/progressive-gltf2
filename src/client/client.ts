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


import * as THREE from 'three'
import { FlyControls } from 'three/examples/jsm/controls/FlyControls'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
const  MeshoptDecoder = require('three/examples/jsm/libs/meshopt_decoder.module.js')
import Stats from 'three/examples/jsm/libs/stats.module'

// @ts-ignore
import 'three-sixty/build/three-sixty'








let locks: any = []
let locks_key: any = []

let lock_parse_count = 1;
let lock_parse_count_current = 0;
let lock_fetch_counter = 0;














var mixer: any;

const scene = new THREE.Scene()
scene.add(new THREE.AxesHelper(5))


const color = 0xFFFFFF;
const intensity = 2;
const light = new THREE.AmbientLight(color, intensity);

const light2 = new THREE.DirectionalLight(color, 10);
light2.position.set(0,40,0)
light2.target.position.set(20,0,0)


scene.add(light);
scene.add(light2);
scene.add(light2.target);

const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.01,
	4000
)



const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true})
renderer.physicallyCorrectLights = true
renderer.shadowMap.enabled = true
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

//const controls = new OrbitControls(camera, renderer.domElement)
//controls.enableDamping = true
const controls = new FlyControls( camera, renderer.domElement );
controls.movementSpeed = DEFAULT_MOVEMENT_SPEED;
controls.rollSpeed = Math.PI / 2;
controls.autoForward = false;
controls.dragToLook = true;

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('js/libs/draco/')
dracoLoader.preload()

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('js/libs/basis/' );
ktx2Loader.detectSupport( renderer );

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)
gltfLoader.setKTX2Loader(ktx2Loader)
gltfLoader.setMeshoptDecoder(MeshoptDecoder)

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const urlModel = urlParams.get('model')

const X = Number(urlParams.get('x'))
const Y = Number(urlParams.get('y'))
const Z = Number(urlParams.get('z'))

camera.position.x = X
camera.position.y = Y
camera.position.z = Z
const lockY = camera.position.y


document.addEventListener('keydown', (e) => {
	if (e.shiftKey)
		controls.movementSpeed *= 10
	if (controls.movementSpeed > 2000)
		controls.movementSpeed = 2000
})

document.addEventListener('keydown', (e) => {
	if (e.ctrlKey)
		controls.movementSpeed /= 10
	if (controls.movementSpeed < 2)
		controls.movementSpeed = 2
})



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
	async prepareMultiPack(preparedJson: modelHeader, inpNames: string[],  priorityMap: priorityMap = {}, config: config): Promise<ArrayBuffer|null> {
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

			let utf8Encode = new TextEncoder();
			let jsonBytes = utf8Encode.encode(JSON.stringify(preparedJson))
			let _pack = new ArrayBuffer(20+jsonBytes.length+this._chunk1.byteLength+16) 

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
					partition_metadata["bufferViews"].push(bufferViewIndex);
				});
			
				
			});

		})

	}


	blindPartitions(inpNames: string[]) : any {
		let sum: string = "sum_" + inpNames.join('');
		const modelHeader = this._fullJSONHeader;
		let output:modelHeader = JSON.parse(JSON.stringify(modelHeader)); // TODO fix speed generally slow

		this._partitions_metadata[sum] = {}
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


		output["scenes"] = [{"name":"Scene", "nodes": partition_metadata["nodes"]}]


		return output
	}


}





// Gets run for every object
// @ts-ignore
function loadFancy(inpNames: string[], currentDistanceMap: distanceMap, sherpa: any, config: config): void{
	if (inpNames.length > 0){
		let partition = sherpa.blindPartitions(inpNames) // Could be cached



		const gltf_callback = function(gltf:any):any{

			gltf.scene.traverse(function (child:any) {
				if ((child as THREE.Mesh).isMesh) {
					const m = child as THREE.Mesh;
					m.receiveShadow = true;
					m.castShadow = true;
				}
				if ((child as THREE.Light).isLight) {
					const l = child as THREE.Light;
					l.castShadow = true;
					l.shadow.bias = -0.003;
					l.shadow.mapSize.width = 2048;
					l.shadow.mapSize.height = 2048;
				}
			});


			scene.add(gltf.scene);
			// Animations
			mixer = new THREE.AnimationMixer( gltf.scene );
			gltf.animations.forEach( ( clip:any ) => {
				mixer.clipAction( clip ).play();
			});


			inpNames.forEach((lname: string) => {
				sherpa.flagModelLoaded(lname)
			})
			document.dispatchEvent(new CustomEvent("modelLoaded", {detail: {inpNames:inpNames, config:config}}))

			if (typeof locks_key[lock_parse_count] === "function" )
				locks_key[lock_parse_count]()
			//console.log("after parse", locks, lock_fetch_counter, lock_fetch_counter)
			lock_parse_count++
		};


		const gltf_error = function(error: any): any{
			console.error("Error detected with loading", inpNames, "retrying!", JSON.parse(JSON.stringify(sherpa)), error);
		}




		let x = new Promise((resolve) => {
			//console.log(lock_parse_count_current)
			locks_key[lock_parse_count_current] = resolve;
			lock_parse_count_current++
			
		}).then( () => {
			//console.log("lock", lock_parse_count, "resolved");
		});
		locks.push(x)

		locks_key[0]()

		//console.log("before parse", locks, locks_key, lock_fetch_counter)
		
		sherpa.prepareMultiPack(partition, inpNames, [], config).then((pack: ArrayBuffer|null) => {
			if (pack !== null){
				console.log(performance.now(), "gltf parsing", inpNames.length, "this means the fetch has also been completely parsed")
				gltfLoader.parse(pack, "", gltf_callback, gltf_error);
			}
		})



	}
}

let firstLoaded = false
let fovDone = false

const lazy = Number(urlParams.get('l'))
const instant = Number(urlParams.get('i'))


document.addEventListener('keydown', (e) => {
	if (e.key == "c"){
		console.log(camera.position)
	}
})

if (lazy && urlModel?.includes('glb')){
	console.log("Starting;", performance.now())
	loadModel("models/"+urlModel)

} else if (urlModel?.includes('glb')) {
	console.log("Starting;", performance.now())
	let sandy = new Sherpa(urlModel);
	sandy.initPack().then( () => {

		document.addEventListener('queueLoad', (e: any) => {
			const currentDistanceMap = calculateDistanceMap(sandy, camera.position)

			let config = e.detail["config"]
			let sortedNodes = modifyNodes(camera, currentDistanceMap, sandy, config );

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






window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setSize(window.innerWidth, window.innerHeight)
	render()
}

const stats = Stats()
//document.body.appendChild(stats.dom)

function animate() {
	requestAnimationFrame(animate)

	controls.update(0.01)
	if (globalConfig["lockYCoordinate"])
		camera.position.y = lockY;

	render()

	var delta = clock.getDelta();
	if ( mixer ) mixer.update( delta );

	stats.update()
}

function render() {
	renderer.render(scene, camera)
}

animate()



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
	const frustum = new THREE.Frustum();
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
}

//@ts-ignore
function checkByPoint(a: any, camera:any){
	const frustum = new THREE.Frustum();
	frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	let point;
	try { point = new THREE.Vector3(a["translation"][0],a["translation"][1],a["translation"][2]); } catch (error) { console.log(error); point = new THREE.Vector3(0,0,0); } //Default to 0 if no translation

	return frustum.containsPoint(point)
}

function loadModel(model: string): void {
	let t = performance.now();
	fetch(model)
	.then((response) => response.arrayBuffer())
	.then((result) => {
		const a = (performance.now()-t)
		t = performance.now();
		gltfLoader.parse(result, "", 
						 function (gltf) {
							 gltf.scene.traverse(function (child) {
								 if ((child as THREE.Mesh).isMesh) {
									 const m = child as THREE.Mesh
									 m.receiveShadow = true
									 m.castShadow = true
								 }
								 if ((child as THREE.Light).isLight) {
									 const l = child as THREE.Light
									 l.castShadow = true
									 l.shadow.bias = -0.003
									 l.shadow.mapSize.width = 2048
									 l.shadow.mapSize.height = 2048
								 }
							 })

							 scene.add(gltf.scene)

							 // Animations
							 mixer = new THREE.AnimationMixer( gltf.scene );
							 gltf.animations.forEach( ( clip ) => {
								 mixer.clipAction( clip ).play();
							 } );

							 // Performance logging
							 const b = (performance.now()-t)
							 let blob:Blob = new Blob([a.toString()+","+b.toString()+"\n"], {type: "text/plain"});

							 let link:string = window.URL.createObjectURL(blob);
							 let domA = document.createElement("a");
							 domA.download = "done.log";
							 domA.href = link;
							 document.body.appendChild(domA);
							 //domA.click(); //Download data file
							 document.body.removeChild(domA);

							 setTimeout(()=>{
							 console.log("done!;", performance.now())
							 }, 0);
						 })
	})
}






