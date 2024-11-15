# Nostr Tip Finder Chrome Extension

A Chrome extension that helps you find and manage cryptocurrency tipping addresses for Nostr users. Easily search for users and access their Lightning and Nano payment information.

## Features

- 🔍 Search users by name, pubkey, or npub
- ⚡ Find Lightning Network payment addresses
- 💸 Find Nano payment addresses
- 📋 One-click copy for addresses
- ⭐ Save favorite profiles
- 🕒 Recent search history
- 🎨 Dark mode interface

## Installation

### From Source
1. Clone this repository:
bash
git clone https://github.com/mnpezz/nostr_address_book.git
cd nostr-address_book

2. Install dependencies:
bash
npm install

3. Build the extension:
bash
npm run build


4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `nostr-tip-finder` directory

## Usage

1. Click the extension icon in your Chrome toolbar
2. Search for a Nostr user by:
   - Their name
   - Their public key (hex)
   - Their npub address

3. View the user's:
   - Profile information
   - Lightning addresses
   - Nano addresses

4. Features:
   - Click "Copy" next to any address to copy it to your clipboard
   - Click "Fav" to add profiles to your favorites
   - Recent searches are automatically saved
   - Click on recent searches or favorites to quickly look up profiles again

## Development

### Project Structure
nostr-tip-finder/
├── manifest.json # Extension manifest
├── src/ # Source code
│ └── nostr-bundle.js # Main functionality
├── popup/ # Extension popup
│ ├── popup.html # Popup HTML
│ ├── popup.css # Popup styles
│ └── popup.js # Popup script
├── images/ # Default images
│ ├── default-banner.jpg
│ └── default-avatar.jpg
├── dist/ # Built files
│ └── nostr-bundle.js
└── icons/ # Extension icons
├── icon16.png
├── icon48.png
└── icon128.png

### Building
bash
npm run build


### Testing
After making changes:
1. Run `npm run build`
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test the changes in the extension popup

## Contributing

1. Fork the repository
2. Create a new branch for your feature
3. Make your changes
4. Submit a pull request

## Privacy

This extension:
- Does not collect any personal data
- Stores favorites and recent searches locally
- Only connects to Nostr relays for profile information
- Does not track user activity

## License

MIT License - see LICENSE file for details

## Support

Found this extension useful? Consider supporting development:
- Lightning: [unkindsuit10@minibits.cash]
- Nano: [nano_3urn99zwefm5q8miwqkiypfqx3ikh59ujpiuggewnynoke6eqpntgu78do7j]

## Contact

- GitHub Issues: For bug reports and feature requests
- Nostr: [npub1jdn6j50nukyq82ug6vzn5xmmr0j98xkaemz4tdsulgvutu3e06psp3t054]
- GitHub: [@mnpezz](https://github.com/mnpezz)
