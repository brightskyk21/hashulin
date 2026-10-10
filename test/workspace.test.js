const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {normalizePhoto}=require('../lib/workspace');
test('image uploads decode real raster content, strip metadata, resize and reject unsupported input',async()=>{
 const source=await sharp({create:{width:2600,height:100,channels:3,background:'#abcdef'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'private test'}}}).toBuffer();
 const result=await normalizePhoto(source),meta=await sharp(result).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,2400);assert.equal(meta.exif,undefined);
 await assert.rejects(normalizePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')));
 await assert.rejects(normalizePhoto(Buffer.from('not an image')));
});

test('thumbnail is bounded and does not retain EXIF',async()=>{
 const {normalizeThumbnail}=require('../lib/workspace');
 const source=await sharp({create:{width:2400,height:1800,channels:3,background:'#aabbcc'}}).jpeg().withMetadata().toBuffer();
 const result=await normalizeThumbnail(source),meta=await sharp(result).metadata();
 assert.equal(meta.width,640);assert.equal(meta.height,480);assert.equal(meta.exif,undefined);assert.equal(meta.format,'webp');
});
