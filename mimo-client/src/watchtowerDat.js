const self = new DatArchive(window.location)

document.getElementById('fork_button').addEventListener('click', async function(event) {

  const archive = await DatArchive.fork('ENTER_PROFILE_TEMPLATE_URL_HERE', {
      title: 'Enter A Name For Your Profile',
      type: ['user-profile'],
  })
  const archiveKey = archive.getInfo(info => info.key)
  await self.mkdir(`/${archiveKey}`)

  archive._loadPromise
  archive.watch('/request.json', async function ({path}) {

    const file = await archive.readFile(path)
    const key = await self.writeFile(`/${archiveKey}/profile.json`, file)
  })

})
