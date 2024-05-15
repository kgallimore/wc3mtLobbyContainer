import fs from 'node:fs';
import path from 'path';
import { MicroLobby } from './../tsrc/index'; // Assuming Microlobby is exported from this file

// Get all json files in the current directory
const jsonFiles = fs.readdirSync('.').filter(file => path.extname(file) === '.json');
const startData = JSON.parse(fs.readFileSync(jsonFiles[0], 'utf-8'));
let microLobby: MicroLobby;
try{
    microLobby = new MicroLobby({region: "us", payload: startData});
}
catch(e){
    console.error(`Error creating MicroLobby: ${e}`);
    process.exit(1);
}

// Read each json file and import the data into the Microlobby class
jsonFiles.forEach((file, index) => {
    if(index === 0) return;
    const data = fs.readFileSync(file, 'utf-8');
    try{
        microLobby.ingestUpdate(JSON.parse(data));

    }
    catch(e){
        console.error(`Error parsing ${file}: ${e}`);
    }
});
