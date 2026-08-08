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

// The File namespace holds far more than photographs — PDFs, DjVu scans,
// audio, video, SVG. Commons searches document CONTENTS as well as titles, so
// a multi-word query can match text inside an OCR'd book: "MG HS Super Hybrid"
// returned five PDFs, top of them an 1874 journal of horticulture, and not one
// image. filetype:bitmap is a CirrusSearch keyword that confines the search to
// raster images. On that same query it returns nothing at all, which is the
// honest answer — "no candidate returned" beats a horticulture journal.
const BITMAP_ONLY = 'filetype:bitmap';

// Belt and braces. The keyword above is a search-server feature we do not
// control; this check is ours, runs offline, and is what the tests pin. sharp
// cannot decode a PDF or an SVG, so anything slipping through would fail at
// the crop with a far less obvious error than a wrong extension here.
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|tiff?|webp)$/i;

export async function searchFiles(query, { fetchImpl = fetch, limit = 5 } = {}) {
  // srnamespace=6 is the File namespace. Without it the search returns article
  // and category pages, which have no image to download.
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(`${query} ${BITMAP_ONLY}`)}`
    + `&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
  const payload = await getJson(url, fetchImpl);
  return (payload.query?.search ?? [])
    .map(hit => hit.title.replace(/^File:/, ''))
    .filter(title => IMAGE_EXTENSION_RE.test(title));
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
