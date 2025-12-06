"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye } from "lucide-react";
import Link from 'next/link';
import { ToolExecutor } from '../lib/tool-executor';
import { Tool } from '../lib/types';

const binwalk: Tool = {
  id: 'binwalk',
  name: 'Binwalk',
  description: 'Firmware analysis and extraction tool',
  longDescription: 'Binwalk is a fast tool for analyzing and extracting data from binary firmware images. It uses signature scanning to identify embedded file types and can automatically extract them. Essential for reverse engineering firmware and CTF challenges.',
  installCmd: 'apt-get install -y binwalk',
  checkCmd: 'which binwalk',
  documentation: 'https://github.com/ReFirmLabs/binwalk',
  tips: [
    'Always scan first (-e extracts but might miss things)',
    'Use -e -M for recursive extraction of nested archives',
    'Check extracted _filename.extracted/ folder for hidden files',
    'Look for filesystem images (squashfs, cramfs) - mount them!',
    'Combine with strings command to find readable text in binaries',
  ],
  presets: [
    {
      id: 'scan',
      name: 'Signature Scan',
      level: 'basic',
      description: 'Scan file for embedded signatures',
      command: 'binwalk {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'Binary file to analyze', required: true, type: 'text' },
      ],
      notes: ['Shows file types and offsets', 'Does not modify the file', 'First step in analysis'],
    },
    {
      id: 'extract',
      name: 'Extract Files',
      level: 'basic',
      description: 'Automatically extract embedded files',
      command: 'binwalk -e {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'File to extract from', required: true, type: 'text' },
      ],
      notes: ['Creates _filename.extracted/ directory', 'Recursively extracts nested archives'],
    },
    {
      id: 'entropy',
      name: 'Entropy Analysis',
      level: 'intermediate',
      description: 'Generate entropy graph (detect encryption/compression)',
      command: 'binwalk -E {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'File to analyze', required: true, type: 'text' },
      ],
      notes: ['High entropy = encrypted/compressed data', 'Low entropy = text/uncompressed data', 'Helps identify interesting regions'],
    },
    {
      id: 'deep-extract',
      name: 'Deep Extraction',
      level: 'advanced',
      description: 'Extract with maximum depth and matryoshka mode',
      command: 'binwalk -Me {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'File to extract', required: true, type: 'text' },
      ],
      notes: ['-M enables matryoshka (nested extraction)', '-e enables extraction', 'Can extract deeply nested files'],
    },
    {
      id: 'carve',
      name: 'Raw Data Carving',
      level: 'advanced',
      description: 'Extract raw data at specific offset',
      command: 'binwalk --dd="{type}:{extension}" {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'Source file', required: true, type: 'text' },
        { name: 'type', placeholder: '.*', description: 'File type signature', required: true, type: 'select', options: [
          { value: '.*', label: 'All types' },
          { value: 'jpeg', label: 'JPEG images' },
          { value: 'png', label: 'PNG images' },
          { value: 'gzip', label: 'Gzip archives' },
          { value: 'zip', label: 'ZIP archives' },
          { value: 'elf', label: 'ELF binaries' },
        ], default: '.*' },
        { name: 'extension', placeholder: 'raw', description: 'Output extension', required: true, type: 'text', default: 'raw' },
      ],
    },
    {
      id: 'opcodes',
      name: 'Opcode Scan',
      level: 'expert',
      description: 'Scan for CPU architecture signatures',
      command: 'binwalk -A {file}',
      args: [
        { name: 'file', placeholder: '/tmp/firmware.bin', description: 'Binary file', required: true, type: 'text' },
      ],
      notes: ['Identifies CPU architecture (ARM, MIPS, x86)', 'Helps in reverse engineering', 'Shows executable code regions'],
    },
  ],
};

const steghide: Tool = {
  id: 'steghide',
  name: 'Steghide',
  description: 'Steganography tool for hiding/extracting data',
  longDescription: 'Steghide is a steganography program that hides data in various kinds of image and audio files. It supports JPEG, BMP, WAV, and AU file formats. Commonly used in CTF challenges to hide flags in innocent-looking images.',
  installCmd: 'apt-get install -y steghide',
  checkCmd: 'which steghide',
  documentation: 'https://steghide.sourceforge.net/documentation.php',
  tips: [
    'Try empty password first - many CTF challenges use no password',
    'Common passwords: password, secret, hidden, steghide, the filename',
    'Only works on JPEG/BMP/WAV - for PNG use zsteg or pngcheck',
    'Use stegcracker to brute-force steghide passwords',
    'Check image metadata with exiftool first for password hints',
  ],
  presets: [
    {
      id: 'info',
      name: 'Check for Hidden Data',
      level: 'basic',
      description: 'Check if file contains hidden data',
      command: 'steghide info {file}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Image or audio file', required: true, type: 'text' },
      ],
      notes: ['Works with JPEG, BMP, WAV, AU files', 'Shows if data is embedded', 'May prompt for passphrase'],
    },
    {
      id: 'extract-nopass',
      name: 'Extract (No Password)',
      level: 'basic',
      description: 'Extract hidden data without password',
      command: 'steghide extract -sf {file} -p ""',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Cover file', required: true, type: 'text' },
      ],
      notes: ['Tries empty password', 'Common in basic CTF challenges'],
    },
    {
      id: 'extract-pass',
      name: 'Extract with Password',
      level: 'intermediate',
      description: 'Extract using known password',
      command: 'steghide extract -sf {file} -p {password}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Cover file', required: true, type: 'text' },
        { name: 'password', placeholder: 'secret', description: 'Passphrase', required: true, type: 'text' },
      ],
    },
    {
      id: 'extract-output',
      name: 'Extract to File',
      level: 'intermediate',
      description: 'Extract and save to specific file',
      command: 'steghide extract -sf {file} -p {password} -xf {output}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Cover file', required: true, type: 'text' },
        { name: 'password', placeholder: '', description: 'Passphrase (empty for none)', required: false, type: 'text' },
        { name: 'output', placeholder: '/tmp/extracted.txt', description: 'Output file path', required: true, type: 'text' },
      ],
    },
    {
      id: 'embed',
      name: 'Embed Data',
      level: 'advanced',
      description: 'Hide data in a cover file',
      command: 'steghide embed -cf {cover} -ef {data} -p {password} -sf {output}',
      args: [
        { name: 'cover', placeholder: '/tmp/original.jpg', description: 'Cover image/audio file', required: true, type: 'text' },
        { name: 'data', placeholder: '/tmp/secret.txt', description: 'File to hide', required: true, type: 'text' },
        { name: 'password', placeholder: '', description: 'Passphrase', required: false, type: 'text' },
        { name: 'output', placeholder: '/tmp/stego.jpg', description: 'Output stego file', required: true, type: 'text' },
      ],
      notes: ['Creates a new file with hidden data', 'Original cover file unchanged'],
    },
    {
      id: 'bruteforce',
      name: 'Bruteforce Password',
      level: 'expert',
      description: 'Crack password using stegcracker',
      command: 'stegcracker {file} {wordlist}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Stego file', required: true, type: 'text' },
        { name: 'wordlist', placeholder: '/usr/share/wordlists/rockyou.txt', description: 'Password wordlist', required: true, type: 'text', default: '/usr/share/wordlists/rockyou.txt' },
      ],
      notes: ['Requires stegcracker: pip install stegcracker', 'Can be slow with large wordlists'],
    },
  ],
};

const exiftool: Tool = {
  id: 'exiftool',
  name: 'ExifTool',
  description: 'Read and write metadata in files',
  longDescription: 'ExifTool is a platform-independent library and command-line tool for reading, writing, and editing meta information in a wide variety of files. It supports EXIF, GPS, IPTC, XMP, JFIF, and many other metadata formats.',
  installCmd: 'apt-get install -y exiftool',
  checkCmd: 'which exiftool',
  documentation: 'https://exiftool.org/',
  presets: [
    {
      id: 'read-all',
      name: 'Read All Metadata',
      level: 'basic',
      description: 'Extract all metadata from a file',
      command: 'exiftool {file}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'File to analyze', required: true, type: 'text' },
      ],
      notes: ['Works with images, documents, videos, audio', 'Shows all available metadata'],
    },
    {
      id: 'read-gps',
      name: 'Extract GPS Data',
      level: 'basic',
      description: 'Get GPS coordinates from image',
      command: 'exiftool -gps* -c "%.6f" {file}',
      args: [
        { name: 'file', placeholder: '/tmp/photo.jpg', description: 'Image with GPS data', required: true, type: 'text' },
      ],
      notes: ['Shows latitude/longitude in decimal format', 'Common in OSINT challenges'],
    },
    {
      id: 'common-tags',
      name: 'Common Tags',
      level: 'intermediate',
      description: 'Extract commonly useful metadata',
      command: 'exiftool -Author -Creator -CreateDate -ModifyDate -Copyright -Comment -UserComment -ImageDescription {file}',
      args: [
        { name: 'file', placeholder: '/tmp/file.pdf', description: 'File to examine', required: true, type: 'text' },
      ],
      notes: ['Extracts author info, dates, comments', 'May reveal hidden information in CTF'],
    },
    {
      id: 'verbose',
      name: 'Verbose Analysis',
      level: 'intermediate',
      description: 'Show all metadata with hex dumps',
      command: 'exiftool -v3 {file}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'File to analyze', required: true, type: 'text' },
      ],
      notes: ['Very detailed output', 'Shows raw hex data', 'Useful for finding hidden data'],
    },
    {
      id: 'extract-thumb',
      name: 'Extract Thumbnail',
      level: 'advanced',
      description: 'Extract embedded thumbnail image',
      command: 'exiftool -b -ThumbnailImage {file} > /tmp/thumbnail.jpg',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'Image with thumbnail', required: true, type: 'text' },
      ],
      notes: ['Thumbnail may differ from main image', 'Could contain hidden flag in CTF'],
    },
    {
      id: 'recursive',
      name: 'Recursive Scan',
      level: 'advanced',
      description: 'Scan all files in directory',
      command: 'exiftool -r -ext jpg -ext png -ext pdf {dir}',
      args: [
        { name: 'dir', placeholder: '/tmp/files/', description: 'Directory to scan', required: true, type: 'text' },
      ],
      notes: ['-r for recursive', '-ext filters file types', 'Good for batch analysis'],
    },
    {
      id: 'strip',
      name: 'Strip All Metadata',
      level: 'expert',
      description: 'Remove all metadata from file',
      command: 'exiftool -all= {file}',
      args: [
        { name: 'file', placeholder: '/tmp/image.jpg', description: 'File to clean', required: true, type: 'text' },
      ],
      notes: ['Removes ALL metadata', 'Creates backup with _original suffix', 'Use -overwrite_original to skip backup'],
      dangerous: true,
    },
  ],
};

const volatility: Tool = {
  id: 'volatility',
  name: 'Volatility',
  description: 'Memory forensics framework',
  longDescription: 'Volatility is an advanced memory forensics framework for analyzing RAM dumps. It can extract running processes, network connections, loaded modules, registry hives, and much more from memory images. Essential for malware analysis and CTF forensics challenges.',
  installCmd: 'apt-get install -y volatility || pip install volatility3',
  checkCmd: 'which vol.py || which volatility || which vol',
  documentation: 'https://volatility3.readthedocs.io/',
  presets: [
    {
      id: 'imageinfo',
      name: 'Image Info (v2)',
      level: 'basic',
      description: 'Identify memory dump profile (Volatility 2)',
      command: 'volatility -f {dump} imageinfo',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump file', required: true, type: 'text' },
      ],
      notes: ['First step in analysis', 'Identifies OS profile', 'Use suggested profile in subsequent commands'],
    },
    {
      id: 'windows-info',
      name: 'Windows Info (v3)',
      level: 'basic',
      description: 'Get Windows memory info (Volatility 3)',
      command: 'vol -f {dump} windows.info',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Volatility 3 syntax', 'Auto-detects OS version'],
    },
    {
      id: 'pslist',
      name: 'Process List',
      level: 'intermediate',
      description: 'List running processes',
      command: 'vol -f {dump} windows.pslist',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Shows active processes', 'PID, PPID, timestamps', 'First step in process analysis'],
    },
    {
      id: 'pstree',
      name: 'Process Tree',
      level: 'intermediate',
      description: 'Show process parent-child relationships',
      command: 'vol -f {dump} windows.pstree',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Visual hierarchy of processes', 'Helps identify suspicious parent-child relations'],
    },
    {
      id: 'cmdline',
      name: 'Command Lines',
      level: 'intermediate',
      description: 'Extract process command line arguments',
      command: 'vol -f {dump} windows.cmdline',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Shows how processes were launched', 'May reveal flags, passwords, file paths'],
    },
    {
      id: 'filescan',
      name: 'File Scan',
      level: 'advanced',
      description: 'Find file objects in memory',
      command: 'vol -f {dump} windows.filescan',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Lists file handles', 'Use offset to dump specific files', 'Can find deleted files still in memory'],
    },
    {
      id: 'netscan',
      name: 'Network Connections',
      level: 'advanced',
      description: 'List network connections and listening ports',
      command: 'vol -f {dump} windows.netscan',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Shows established connections', 'Includes listening ports', 'Useful for C2 identification'],
    },
    {
      id: 'dumpfiles',
      name: 'Dump Files',
      level: 'expert',
      description: 'Extract files from memory',
      command: 'vol -f {dump} windows.dumpfiles --pid {pid}',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
        { name: 'pid', placeholder: '1234', description: 'Process ID to dump files from', required: true, type: 'number' },
      ],
      notes: ['Extracts files from process memory', 'Output to current directory', 'Useful for extracting malware'],
    },
    {
      id: 'hashdump',
      name: 'Password Hashes',
      level: 'expert',
      description: 'Extract Windows password hashes',
      command: 'vol -f {dump} windows.hashdump',
      args: [
        { name: 'dump', placeholder: '/tmp/memory.dmp', description: 'Memory dump', required: true, type: 'text' },
      ],
      notes: ['Extracts NTLM hashes', 'Requires SYSTEM and SAM hives in memory', 'Crack with John/Hashcat'],
    },
  ],
};

export default function ForensicsToolsPage() {
  const [selectedTool, setSelectedTool] = useState<string>('binwalk');

  const tools: Record<string, Tool> = { binwalk, steghide, exiftool, volatility };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/ctf/tools">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <Eye className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Forensics & Steganography</h2>
            <p className="text-xs text-muted-foreground">Digital forensics and hidden data analysis</p>
          </div>
        </div>
      </div>

      <Tabs value={selectedTool} onValueChange={setSelectedTool} className="flex-1">
        <TabsList>
          <TabsTrigger value="binwalk">Binwalk</TabsTrigger>
          <TabsTrigger value="steghide">Steghide</TabsTrigger>
          <TabsTrigger value="exiftool">ExifTool</TabsTrigger>
          <TabsTrigger value="volatility">Volatility</TabsTrigger>
        </TabsList>
        
        {Object.entries(tools).map(([id, tool]) => (
          <TabsContent key={id} value={id} className="mt-4">
            <ToolExecutor tool={tool} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

