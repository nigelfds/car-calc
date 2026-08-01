// scripts/images/commons.js — the two Wikimedia Commons calls this feature
// needs: search for candidate files, and read one file's licence, author and
// download URL.
//
// fetch is injected so the tests never touch the network. Commons asks API
// clients to identify themselves with a contactable User-Agent; anonymous
// clients get rate-limited harder.

const API = 'https://commons.wikimedia.org/w/api.php';
export const USER_AGENT = 'car-calc-images/1.0 (https://github.com/nigelfds/car-calc; nigel@nigel.in)';

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Commons request failed: ${response.status}`);
  return response.json();
}

export async function searchFiles(query, { fetchImpl = fetch, limit = 5 } = {}) {
  // srnamespace=6 is the File namespace. Without it the search returns article
  // and category pages, which have no image to download.
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(query)}`
    + `&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
  const payload = await getJson(url, fetchImpl);
  return (payload.query?.search ?? []).map(hit => hit.title.replace(/^File:/, ''));
}

export async function fileMetadata(title, { fetchImpl = fetch } = {}) {
  const url = `${API}?action=query&titles=${encodeURIComponent(`File:${title}`)}`
    + '&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*';
  const payload = await getJson(url, fetchImpl);
  const page = Object.values(payload.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`no image info for ${title}`);

  const meta = info.extmetadata ?? {};
  // extmetadata values are HTML fragments — Artist is typically an anchor to
  // the uploader's user page. Strip the markup: this string is written into a
  // committed data file and rendered on the credits page.
  const author = String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();

  return {
    downloadUrl: info.url,
    descriptionUrl: info.descriptionurl,
    author,
    licence: String(meta.LicenseShortName?.value ?? '').trim()
  };
}
