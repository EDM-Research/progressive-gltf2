# Progressive Network Streaming of Textured Meshes in the Binary glTF 2.0 Format

![progressive-gltf2-splashimage](https://github.com/EDM-Research/progressive-gltf2/assets/4068862/4365fd66-60a0-44be-a75c-8e62b7762294)


## Abstract

The glTF 2.0 graphics format allows for the API-neutral representation of 3D scenes consisting of one or multiple textured meshes. It is currently adopted as one of two file formats for 3D asset interoperability by the Metaverse Standards Forum. glTF 2.0 has however not been designed to be streamable over the network; instead, glTF 2.0 files typically first need to be downloaded fully before their contents can be rendered locally. This can lead to high start-up delays which in turn can lead to user frustration. This paper therefore contributes a methodology and associated Web-based client, implemented in JavaScript on top of the three.js rendering engine, that allows to stream glTF 2.0 files from a content server to the consuming client up to the level of individual glTF bufferviews. This in turn facilitates the progressive client-side rendering of 3D scenes, meaning that scene rendering can already commence while the glTF file is still being downloaded. The proposed methodology is conceptually compliant with the HTTP Adaptive Streaming (HAS) paradigm that dominates the contemporary market of over-the-top video streaming. Experimental results show that our methodology is most beneficial when network throughput is limited (e.g., 20Mbps). In all, our work represents an important step towards making 3D content faster accessible to consuming (Web) clients, akin to the way platforms like YouTube have brought universal accessibility for video content.

## Citation

```
@inproceedings{10.1145/3611314.3615907,
  author = {Lemoine, Wouter and Wijnants, Maarten},
  title = {Progressive Network Streaming of Textured Meshes in the Binary glTF 2.0 Format},
  year = {2023},
  isbn = {9798400703249},
  publisher = {Association for Computing Machinery},
  doi = {10.1145/3611314.3615907},
  booktitle = {Proceedings of the 28th International ACM Conference on 3D Web Technology},
  series = {Web3D '23}
}
```

## Acknowledgments

The research leading to these results has received funding from the European Union's Horizon Europe Programme under grant agreement 101070072, **MAX-R (Mixed Augmented and eXtended Reality media pipeline)**.

![logo_maxr_main_sRGB](https://github.com/EDM-Research/progressive-gltf2/assets/4068862/6c64df22-cfca-4ab3-8b4a-609c56317319)
