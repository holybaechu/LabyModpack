const axios = require('axios');
const fs = require('fs')
const { execSync } = require('child_process');
const path = require('path');

async function getVersionByGameVersion(game_version, modId, modLoader){
    const versions = (await axios.get(`https://api.modrinth.com/v2/project/${modId}/version`, {})).data

    let matchVersion = versions[0]
    for (let version of versions){
        const baseVersion = game_version.split(".")[0] + '.' + game_version.split(".")[1]
        if (version.game_versions.includes(baseVersion) && version.loaders.includes(modLoader)){
            matchVersion = version
        }
    }

    for (let version of versions){
        if (version.game_versions.includes(game_version) && version.loaders.includes(modLoader)){
            matchVersion = version
        }
    }

    return matchVersion
};

(async () => {
    const versions = JSON.parse(await fs.readFileSync('versions.json', 'utf-8'))
    const manifest = JSON.parse(await fs.readFileSync('../manifest.json', 'utf-8'))
    const mods = JSON.parse(await fs.readFileSync('../mods.json', 'utf-8'))

    for (let version of versions){
        await execSync(`ezpack export modrinth ${version}`, {cwd: path.basename(path.dirname(__dirname))})
        await execSync(`ezpack export modsZip ${version}`, {cwd: path.basename(path.dirname(__dirname))})

        let expectedMrpackName = `Modrinth-${version}.mrpack`
        let expectedZipName = `ModsZip-${version}.zip`

        const dependencies = []
        for (let mod of mods){
            let modVersionInfo = mod.mirrors["Modrinth"] ? await getVersionByGameVersion(version, mod.mirrors["Modrinth"].id, manifest.modloader) : null

            dependencies.push({
                dependency_type: "embedded",
                file_name: modVersionInfo != null ? modVersionInfo.files[0].filename : null,
                project_id: mod.mirrors["Modrinth"] ? mod.mirrors["Modrinth"].id : null,
                version_id: modVersionInfo != null ? modVersionInfo.id : null
            })
        }

        const data = {
            name: `${manifest.name} ${manifest.version} for ${version}`,
            changelog: process.env['commit_message'],
            version_number: manifest.version,
            game_versions: [version],
            loaders: [manifest.modloader],
            featured: true,
            status: 'listed',
            requested_status: 'listed',
            project_id: 'In8bmloC',
            file_parts: ['mrpack', 'zip'],
            primary_file: 'zip',
            dependencies: dependencies
        }

        const formData = new FormData();
        formData.append('data', JSON.stringify(data))
        formData.append('mrpack', fs.createReadStream(path.basename(path.dirname(__dirname))+'/exports/'+expectedMrpackName))
        formData.append('zip', fs.createReadStream(path.basename(path.dirname(__dirname))+'/exports/'+expectedZipName))

        await axios.post("https://api.modrinth.com/v2/version", {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': process.env.token,
            },
            data: formData
        })
    }
})()