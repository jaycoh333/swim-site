export interface ArchiveEntry {
  id: string;
  category: string;
  timestamp: string;
  excerpt: string;
  signalStrength: number;
  replies: number;
  full?: string;
}

export const ARCHIVE_ENTRIES: ArchiveEntry[] = [
  {
    id: '0x1A3F',
    category: 'CONFESSIONS',
    timestamp: '05/15/01 03:33 AM',
    excerpt: "I told my wife I was at work for three years. I was driving. Just driving. The radio had a station that only played between 2 and 4 AM. It knew my name.",
    signalStrength: 5,
    replies: 23,
  },
  {
    id: '0x2C8B',
    category: 'DREAMS',
    timestamp: '06/01/01 11:11 PM',
    excerpt: "There is a city that only exists at 3 AM. Everyone there knows me. I have never met any of them. Last night one of them handed me a key.",
    signalStrength: 4,
    replies: 41,
  },
  {
    id: '0x3D7E',
    category: 'PARANORMAL',
    timestamp: '07/07/01 12:00 AM',
    excerpt: "The door on the 4th floor wasn't there last week. I know because I count doors. I have always counted doors. It was not there and now it is.",
    signalStrength: 5,
    replies: 88,
  },
  {
    id: '0x4A2C',
    category: 'THEORIES',
    timestamp: '08/15/01 02:17 AM',
    excerpt: "The moon records everything. Every conversation you've had outdoors since 1969 is stored somewhere we cannot access. Someone can.",
    signalStrength: 3,
    replies: 14,
  },
  {
    id: '0x5F9D',
    category: 'GLITCHES',
    timestamp: '09/22/01 04:44 AM',
    excerpt: "I found a file on my desktop called everything_everywhere.log. I didn't create it. I opened it. It started answering back. I closed it. It opened itself.",
    signalStrength: 5,
    replies: 67,
  },
  {
    id: '0x6B1A',
    category: 'RELATIONSHIPS',
    timestamp: '10/31/01 06:06 AM',
    excerpt: "We talked every night for two years. I still don't know their real name. I don't need to. We understood something together that I cannot explain to anyone else.",
    signalStrength: 4,
    replies: 31,
  },
  {
    id: '0x7E4F',
    category: 'SURVIVAL',
    timestamp: '11/11/01 11:11 PM',
    excerpt: "The trick to surviving the quiet is to make it work for you. Stop filling silence. Let it tell you what it knows. It knows a lot. Most of it is about you.",
    signalStrength: 3,
    replies: 9,
  },
  {
    id: '0x8C3D',
    category: 'TRIP REPORTS',
    timestamp: '12/25/01 03:00 AM',
    excerpt: "At the edge of it there is a frequency. Not sound. Not light. It is the closest thing to a second self I have encountered. It recognized me first.",
    signalStrength: 5,
    replies: 55,
  },
  {
    id: '0x9A7B',
    category: 'CRYPTO',
    timestamp: '01/01/02 00:00 AM',
    excerpt: "The wallet address resolved to coordinates. The coordinates resolved to a payphone. The payphone rang at exactly the time the block confirmed. Nobody was there.",
    signalStrength: 4,
    replies: 38,
  },
];

export const RECENT_THREADS = [
  {
    id: '#3381',
    time: '3m ago',
    preview: 'SWIM had the dream again. Same coordinates. Same frequency on the dial.',
    echoes: 7,
  },
  {
    id: '#3380',
    time: '11m ago',
    preview: 'Found the old forum. Not linked anywhere. The last post was from someone with my birthday.',
    echoes: 22,
  },
  {
    id: '#3379',
    time: '34m ago',
    preview: 'The archive remembers things I deleted. I know because I checked.',
    echoes: 41,
  },
  {
    id: '#3378',
    time: '1h ago',
    preview: 'You are not the person who started reading this sentence.',
    echoes: 137,
  },
];

export const SIGNAL_FEED = [
  { freq: '89.3 MHz', message: 'CONNECTION STABLE. ARCHIVE DEPTH: UNKNOWN.' },
  { freq: '91.7 MHz', message: 'SWIM DETECTED: 247 PARTICIPANTS.' },
  { freq: '94.1 MHz', message: 'NEW ENTRY: [CONFESSIONS/0x1A3F] SIGNAL STRONG.' },
  { freq: '98.6 MHz', message: 'ANOMALY IN SECTOR 4. INVESTIGATING.' },
  { freq: '103.2 MHz', message: 'VAULT DOOR: SEALED. ACCESS REQUIRES $SWIM.' },
  { freq: '107.9 MHz', message: 'THE ARCHIVE REMEMBERS. THE ARCHIVE ALWAYS REMEMBERS.' },
];

export const MAP_ENTRIES = [
  { coords: '40.7128° N, 74.0060° W', label: 'THE PAYPHONE', note: 'It rang once. Nobody was calling.' },
  { coords: '51.5074° N, 0.1278° W', label: 'THE SIGNAL TOWER', note: 'Broadcasts on a frequency that does not exist.' },
  { coords: '35.6762° N, 139.6503° E', label: 'DOOR 4F', note: 'Was not there. Now it is.' },
  { coords: '48.8566° N, 2.3522° E', label: 'THE TRANSIT NODE', note: 'Three people had the same dream here on the same night.' },
  { coords: '55.7558° N, 37.6173° E', label: 'ARCHIVE MIRROR', note: 'Someone maintains a physical copy. We think.' },
  { coords: '19.4326° N, 99.1332° W', label: 'THE STATION', note: 'Only broadcasts between 2 and 4 AM. Nobody runs it.' },
];
