/* Small, dependency-free ZIP STORE writer for map scene + interior JSON exports. */
(function(global){"use strict";
 const encoder=new TextEncoder();
 const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
 function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
 function pack(files){
  if(!Array.isArray(files)||!files.length)throw Error("ZIPに入れるファイルがありません");
  const parts=[],directory=[];let offset=0;
  const u16=(view,pos,num)=>view.setUint16(pos,num,true),u32=(view,pos,num)=>view.setUint32(pos,num>>>0,true);
  for(const item of files){
   const name=item.name;
   if(typeof name!=="string"||!name||name.startsWith("/")||name.split("/").some(p=>p===".."||!p))
    throw Error("ZIPのパスが不正です: "+name);
   const filename=encoder.encode(name),bytes=encoder.encode(item.content),crc=crc32(bytes);
   if(filename.length>65535||bytes.length>0xffffffff)throw Error("ZIPファイルが大きすぎます");
   const lh=new Uint8Array(30+filename.length),l=new DataView(lh.buffer);
   u32(l,0,0x04034b50);u16(l,4,20);u16(l,6,0x0800);u16(l,8,0);
   u32(l,14,crc);u32(l,18,bytes.length);u32(l,22,bytes.length);
   u16(l,26,filename.length);lh.set(filename,30);
   parts.push(lh,bytes);
   const ch=new Uint8Array(46+filename.length),c=new DataView(ch.buffer);
   u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x0800);u16(c,10,0);
   u32(c,16,crc);u32(c,20,bytes.length);u32(c,24,bytes.length);
   u16(c,28,filename.length);u32(c,42,offset);ch.set(filename,46);
   directory.push(ch);offset+=lh.length+bytes.length;
  }
  if(files.length>65535)throw Error("ZIPのファイル数が多すぎます");
  const centralSize=directory.reduce((sum,b)=>sum+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);
  u32(e,12,centralSize);u32(e,16,offset);
  return new Blob([...parts,...directory,end],{type:"application/zip"});
 }
 global.AAMapZip={pack};
})(window);
