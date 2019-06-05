const self = new DatArchive(window.location)
const tower = new DatArchive('ENTER_WATCHTOWER_URL_HERE')
const selfKey = self.getInfo(info => info.key)

const updateUI = (field, value) => document.getElementById(field).value = value

tower._loadPromise
tower.watch(`/${selfKey}/profile.json`, async function ({path}) {
  const file = await tower.readFile(path)
  const changes = Object.entries(JSON.parse(file))
  changes.forEach(change => updateUI(change[0], change[1]))
})

document.getElementById('update_profile_button').addEventListener('click', async function(event) {
  const username = { username: document.getElementById('username').value }
  const bio = { bio: document.getElementById('bio').value }
  await sendRequest([username, bio])
})

const sendRequest = async ([first second]) => {
  const request = { first, second }
  await self.writeFile('/request.json', request)
}
