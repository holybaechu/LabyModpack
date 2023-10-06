const axios = require('axios');
const fs = require('fs')
const { execSync } = require('child_process');
const path = require('path');
const formdata = require('form-data')

require('dotenv').config()

async function getVersionIdByVersion(mc_version){
    const versions = await axios.get("https://minecraft.curseforge.com/api/game/versions", {
        headers: {
            'X-Api-Token': process.env.token,
            'User-Agent': "https://github.com/baechooYT/ezpack"
        }
    })

    let curseForgeVersion = versions.data[0]
    for (let version of versions.data){
        if (version.name == mc_version){
            curseForgeVersion = version
        }
    }

    return curseForgeVersion.id
}

(async () => {
    const versions = JSON.parse(await fs.readFileSync('versions.json', 'utf-8'))
    const manifest = JSON.parse(await fs.readFileSync('../manifest.json', 'utf-8'))
    const mods = JSON.parse(await fs.readFileSync('../mods.json', 'utf-8'))

    for (let version of versions){
        await execSync(`ezpack export CurseForge ${version}`, {cwd: path.dirname(__dirname)})
        let expectedZipName = `CurseForge-${version}.zip`

        const dependencies = []
        for (let mod of mods){
            if (mod.mirrors["CurseForge"]) {
                dependencies.push({
                    slug: mod.slug,
                    type: 'embeddedLibrary'
                })
            }
        }

        const data = {
            displayName: `${manifest.name} ${manifest.version} for ${version}`,
            changelog: process.env['commitMessage'],
            gameVersions: [await getVersionIdByVersion(version)],
            loaders: [manifest.modloader],
            releaseType: 'alpha',
            relations: {projects: dependencies}
        }

        const formData = new formdata();
        formData.append('metadata', JSON.stringify(data))
        formData.append('file', fs.createReadStream(path.dirname(__dirname)+'/exports/'+expectedZipName), {
            filename: expectedZipName
        })

        await axios.post("https://minecraft.curseforge.com/api/projects/919035/upload-file", formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'X-Api-Token': process.env.token,
                'User-Agent': "https://github.com/baechooYT/ezpack"
            }
        })
    }
})()