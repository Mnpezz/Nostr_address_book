import * as NostrTools from 'nostr-tools';

// NostrClient class implementation
class NostrClient {
  constructor() {
    this.relays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.nostr.info',
      'wss://nostr.wine',
      'wss://relay.snort.social'
    ];
    this.relay = null;
    this.nostrTools = NostrTools;
  }

  async connect() {
    try {
      // Try connecting to relays in order until one works
      for (const relay of this.relays) {
        try {
          console.log(`Trying to connect to ${relay}...`);
          this.relay = this.nostrTools.relayInit(relay);
          await this.relay.connect();
          console.log(`Connected to ${relay}`);
          return true;
        } catch (err) {
          console.log(`Failed to connect to ${relay}:`, err);
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to connect to any relay:', error);
      return false;
    }
  }

  async searchByName(name) {
    try {
      const filters = {
        kinds: [0],
        limit: 50
      };

      let allEvents = [];
      // Search across multiple relays
      for (const relay of this.relays) {
        try {
          const relayInstance = this.nostrTools.relayInit(relay);
          await relayInstance.connect();
          const events = await relayInstance.list([filters]);
          allEvents = [...allEvents, ...events];
        } catch (err) {
          console.log(`Failed to fetch from ${relay}:`, err);
        }
      }

      // Score and sort matches
      const matches = allEvents
        .map(event => {
          try {
            const profile = JSON.parse(event.content);
            const score = this.calculateMatchScore(profile, name);
            return { ...profile, pubkey: event.pubkey, score };
          } catch (e) {
            return null;
          }
        })
        .filter(profile => profile && profile.score > 0)
        .sort((a, b) => b.score - a.score);

      if (matches.length === 0) return null;

      const bestMatch = matches[0];
      return {
        ...bestMatch,
        tipOptions: this.extractTipOptions(bestMatch)
      };
    } catch (error) {
      console.error('Failed to search by name:', error);
      return null;
    }
  }

  async getUserProfile(identifier) {
    try {
      let pubkey = identifier;
      
      // If it's an npub, decode it
      if (identifier.startsWith('npub')) {
        pubkey = this.nostrTools.nip19.decode(identifier).data;
      } 
      // If it doesn't look like a hex pubkey, try name search
      else if (!/^[0-9a-f]{64}$/.test(identifier)) {
        return await this.searchByName(identifier);
      }

      const filter = {
        kinds: [0],
        authors: [pubkey]
      };

      const events = await this.relay.list([filter]);
      if (events.length === 0) return null;

      const profile = JSON.parse(events[0].content);
      const notes = await this.getRecentNotes(pubkey);
      
      return {
        ...profile,
        pubkey: events[0].pubkey,
        tipOptions: this.extractTipOptions(profile),
        recentNotes: notes
      };
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }

  extractTipOptions(profile) {
    const tipOptions = {
      lightning: [],
      nano: []
    };

    // Lightning addresses
    if (profile.lud16) tipOptions.lightning.push(profile.lud16);
    if (profile.lud06) tipOptions.lightning.push(profile.lud06);

    // Monero addresses - improved regex and parsing
    if (profile.about) { 
      // Nano addresses
      const nanoRegex = /nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}/g;
      const nanoMatches = profile.about.match(nanoRegex) || [];
      tipOptions.nano = nanoMatches;
    }

    // Log found addresses for debugging
    console.log('Found tip options:', tipOptions);
    return tipOptions;
  }

  async searchProfiles(query) {
    try {
      if (!query || query.length < 2) return [];
  
      // Search in multiple relays for better results
      const filters = {
        kinds: [0],
        limit: 20,
        // Add text search filter
        search: query
      };
  
      let events = [];
      for (const relay of this.relays) {
        try {
          const relayInstance = this.nostrTools.relayInit(relay);
          await relayInstance.connect();
          const relayEvents = await relayInstance.list([filters]);
          events = [...events, ...relayEvents];
        } catch (error) {
          console.log(`Failed to fetch from relay ${relay}:`, error);
        }
      }
  
      // Better profile matching
      const profiles = events
        .map(event => {
          try {
            const profile = JSON.parse(event.content);
            return {
              ...profile,
              pubkey: event.pubkey,
              score: calculateMatchScore(profile, query)
            };
          } catch (e) {
            return null;
          }
        })
        .filter(profile => profile && profile.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
  
      return profiles;
    } catch (error) {
      console.error('Failed to search profiles:', error);
      return [];
    }
  }
  
  calculateMatchScore(profile, query) {
    const searchStr = query.toLowerCase();
    let score = 0;
    
    // Exact matches
    if (profile.name?.toLowerCase() === searchStr) score += 100;
    if (profile.display_name?.toLowerCase() === searchStr) score += 90;
    if (profile.nip05?.split('@')[0].toLowerCase() === searchStr) score += 80;
    
    // Partial matches
    if (profile.name?.toLowerCase().includes(searchStr)) score += 50;
    if (profile.display_name?.toLowerCase().includes(searchStr)) score += 40;
    if (profile.nip05?.toLowerCase().includes(searchStr)) score += 30;
    
    // Verified profiles get a boost
    if (profile.nip05) score += 20;
    
    return score;
  }

  async getRecentNotes(pubkey, limit = 5) {
    try {
      const filter = {
        kinds: [1], // Regular notes
        authors: [pubkey],
        limit: limit
      };

      const events = await this.relay.list([filter]);
      return events.map(event => ({
        content: this.formatNoteContent(event.content),
        created_at: new Date(event.created_at * 1000).toLocaleString(),
        id: event.id
      }));
    } catch (error) {
      console.error('Failed to fetch recent notes:', error);
      return [];
    }
  }

  formatNoteContent(content) {
    // Remove URLs
    content = content.replace(/https?:\/\/[^\s]+/g, '');
    // Remove nostr: links
    content = content.replace(/nostr:[^\s]+/g, '');
    // Trim whitespace
    content = content.trim();
    // Limit length
    if (content.length > 280) {
      content = content.substring(0, 280) + '...';
    }
    return content;
  }
}

async function loadFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['recentSearches', 'favorites'], (result) => {
      resolve({
        recentSearches: result.recentSearches || [],
        favorites: result.favorites || []
      });
    });
  });
}

async function saveToStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function generateQR(text, container) {
  const size = 150;
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(text)}&chco=FFFFFF`;
  const img = document.createElement('img');
  img.src = qrUrl;
  img.alt = 'QR Code';
  img.width = size;
  img.height = size;
  container.appendChild(img);
}

function addToRecentSearches(profile) {
  loadFromStorage().then(({ recentSearches }) => {
    const newRecent = [
      { pubkey: profile.pubkey, name: profile.name, picture: profile.picture },
      ...recentSearches.filter(p => p.pubkey !== profile.pubkey)
    ].slice(0, 5);
    
    saveToStorage('recentSearches', newRecent);
    displayRecentSearches(newRecent);
  });
}

function displayRecentSearches(searches) {
  const container = document.querySelector('.recent-list');
  container.innerHTML = searches.map(profile => `
    <div class="recent-item" data-pubkey="${profile.pubkey}">
      <img src="${profile.picture || '../images/default-avatar.jpg'}" 
           onerror="this.src='../images/default-avatar.jpg'" 
           alt="${profile.name}">
      <span>${profile.name || 'Anonymous'}</span>
    </div>
  `).join('');
}

function displayProfile(profile) {
  const banner = document.getElementById('profileBanner');
  if (profile.banner) {
    // Create a temporary image to test if the banner URL is valid
    const tempImage = new Image();
    tempImage.onload = () => {
      banner.style.backgroundImage = `url(${profile.banner})`;
    };
    tempImage.onerror = () => {
      banner.style.backgroundImage = 'url(../images/default-banner.jpg)';
    };
    tempImage.src = profile.banner;
  } else {
    banner.style.backgroundImage = 'url(../images/default-banner.jpg)';
  }
  
  const picture = document.getElementById('profilePicture');
  picture.src = profile.picture || '../images/default-avatar.jpg';
  picture.onerror = () => {
    picture.src = '../images/default-avatar.jpg';
  };
  
  const name = document.getElementById('profileName');
  name.textContent = profile.name || 'Anonymous';
  
  const npub = document.getElementById('profileNpub');
  npub.textContent = NostrTools.nip19.npubEncode(profile.pubkey);
  
  const about = document.getElementById('profileAbout');
  about.textContent = profile.about || '';
  
  const favoriteButton = document.getElementById('favoriteButton');
  favoriteButton.innerHTML = 'Fav';
  favoriteButton.dataset.currentProfile = JSON.stringify(profile);
  
  loadFromStorage().then(({ favorites }) => {
    favoriteButton.classList.toggle('active', favorites.some(f => f.pubkey === profile.pubkey));
  });

  // Add recent notes section
  if (profile.recentNotes && profile.recentNotes.length > 0) {
    const notesSection = document.createElement('div');
    notesSection.className = 'recent-notes';
    notesSection.innerHTML = `
      <h3>Recent Notes</h3>
      ${profile.recentNotes
        .filter(note => note.content.trim()) // Only show notes with content
        .map(note => `
          <div class="note-item">
            <div class="note-content">${note.content}</div>
            <div class="note-date">${note.created_at}</div>
          </div>
        `).join('')}
    `;
    
    // Insert notes section after profile info but before tip options
    const resultsDiv = document.getElementById('results');
    resultsDiv.insertBefore(notesSection, resultsDiv.firstChild);
  }
}

function displayResults(profile) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  // Display profile info
  if (profile) {
    // Display profile info
    displayProfile(profile);
    
    // Display tip options
    if (profile.tipOptions) {
      Object.entries(profile.tipOptions).forEach(([type, addresses]) => {
        if (addresses && addresses.length > 0) {
          console.log(`Found ${type} addresses:`, addresses); // Debug log
          const typeDiv = document.createElement('div');
          typeDiv.className = 'tip-option';
          typeDiv.innerHTML = `<h3>${type.charAt(0).toUpperCase() + type.slice(1)}</h3>`;
          
          addresses.forEach(addr => {
            const container = document.createElement('div');
            container.className = 'address-container';
            container.innerHTML = `
              <span class="address" title="${addr}">${addr}</span>
              <button class="copy-button" data-address="${addr}">Copy</button>
            `;
            typeDiv.appendChild(container);
          });
          
          resultsDiv.appendChild(typeDiv);
        }
      });
    }

    // Add copy button listeners
    document.querySelectorAll('.copy-button').forEach(button => {
      button.addEventListener('click', async (event) => {
        const button = event.target;
        const address = button.dataset.address;
        try {
          await navigator.clipboard.writeText(address);
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    });

    // Add to recent searches
    addToRecentSearches(profile);
  } else {
    resultsDiv.innerHTML = 'No profile found';
  }
}

async function toggleFavorite(profile) {
  const { favorites } = await loadFromStorage();
  const isFavorite = favorites.some(f => f.pubkey === profile.pubkey);
  
  let newFavorites;
  if (isFavorite) {
    newFavorites = favorites.filter(f => f.pubkey !== profile.pubkey);
  } else {
    newFavorites = [...favorites, {
      pubkey: profile.pubkey,
      name: profile.name,
      picture: profile.picture
    }];
  }
  
  await saveToStorage('favorites', newFavorites);
  displayFavorites(newFavorites);
  
  // Update star button
  const favoriteButton = document.getElementById('favoriteButton');
  favoriteButton.classList.toggle('active', !isFavorite);
}

function displayFavorites(favorites) {
  const container = document.querySelector('.favorites-list');
  container.innerHTML = favorites.map(profile => `
    <div class="favorite-item" data-pubkey="${profile.pubkey}">
      <img src="${profile.picture || '../images/default-avatar.jpg'}" 
           onerror="this.src='../images/default-avatar.jpg'" 
           alt="${profile.name}">
      <span>${profile.name || 'Anonymous'}</span>
    </div>
  `).join('');
}

// Main popup functionality
function initializePopup() {
  const client = new NostrClient();
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const favoriteButton = document.getElementById('favoriteButton');
  const resultsDiv = document.getElementById('results');
  const suggestionsDiv = document.getElementById('searchSuggestions');
  let searchTimeout;

  // Load and display recent searches and favorites on startup
  loadFromStorage().then(({ recentSearches, favorites }) => {
    displayRecentSearches(recentSearches);
    displayFavorites(favorites);
  });

  // Add input handler for search suggestions
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Hide suggestions if input is empty
    if (!query) {
      suggestionsDiv.classList.remove('active');
      return;
    }

    // Add debounce to prevent too many requests
    searchTimeout = setTimeout(async () => {
      try {
        await client.connect();
        const suggestions = await client.searchProfiles(query);
        
        if (suggestions.length > 0) {
          suggestionsDiv.innerHTML = suggestions.map(profile => `
            <div class="suggestion-item" data-pubkey="${profile.pubkey}">
              <img src="${profile.picture || '../images/default-avatar.jpg'}" 
                   onerror="this.src='../images/default-avatar.jpg'" 
                   alt="${profile.name || 'Anonymous'}">
              <div class="suggestion-info">
                <div class="suggestion-name">${profile.name || 'Anonymous'}</div>
                <div class="suggestion-npub">${NostrTools.nip19.npubEncode(profile.pubkey)}</div>
              </div>
            </div>
          `).join('');
          suggestionsDiv.classList.add('active');
        } else {
          suggestionsDiv.classList.remove('active');
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    }, 300); // Wait 300ms after last keystroke before searching
  });

  // Handle suggestion clicks
  suggestionsDiv.addEventListener('click', (e) => {
    const suggestionItem = e.target.closest('.suggestion-item');
    if (suggestionItem) {
      const pubkey = suggestionItem.dataset.pubkey;
      searchInput.value = pubkey;
      suggestionsDiv.classList.remove('active');
      searchButton.click();
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      suggestionsDiv.classList.remove('active');
    }
  });

  // Add click handlers for recent searches and favorites
  document.querySelector('.recent-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.recent-item');
    if (item) {
      const pubkey = item.dataset.pubkey;
      searchInput.value = pubkey;
      searchButton.click();
    }
  });

  document.querySelector('.favorites-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.favorite-item');
    if (item) {
      const pubkey = item.dataset.pubkey;
      searchInput.value = pubkey;
      searchButton.click();
    }
  });

  // Add favorite button handler
  favoriteButton.addEventListener('click', () => {
    const currentProfile = favoriteButton.dataset.currentProfile;
    if (currentProfile) {
      toggleFavorite(JSON.parse(currentProfile));
    }
  });

  searchButton.addEventListener('click', async () => {
    console.log('Search button clicked');
    const identifier = searchInput.value.trim();
    if (!identifier) {
      console.log('No identifier provided');
      return;
    }

    resultsDiv.innerHTML = 'Searching...';
    
    try {
      console.log('Attempting to connect to relay...');
      const connected = await client.connect();
      if (!connected) {
        resultsDiv.innerHTML = 'Failed to connect to relay';
        return;
      }
      
      console.log('Connected to relay, fetching profile...');
      const profile = await client.getUserProfile(identifier);
      
      if (!profile) {
        console.log('No profile found');
        resultsDiv.innerHTML = 'User not found';
        return;
      }

      console.log('Found profile:', profile);
      displayResults(profile);
    } catch (error) {
      console.error('Error in search:', error);
      resultsDiv.innerHTML = 'Error fetching user data.';
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);