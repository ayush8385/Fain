export const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", icon: "🍽️" },
  { name: "Transport", icon: "🚗" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Utilities & Bills", icon: "⚡" },
  { name: "Health & Medical", icon: "🏥" },
  { name: "Travel", icon: "✈️" },
  { name: "Groceries", icon: "🛒" },
  { name: "Education", icon: "📚" },
  { name: "Transfers", icon: "💸" },
  { name: "Others", icon: "📦" },
];

// Substring patterns (lowercased) matched against normalized merchant names.
// Order within a category doesn't matter; order across categories doesn't either
// since the categorizer matches on the first rule the merchant pattern satisfies,
// ordered by the user's confirmedCount descending.
export const DEFAULT_MERCHANT_RULES: { merchantPattern: string; categoryName: string }[] = [
  // Food & Dining
  { merchantPattern: "swiggy", categoryName: "Food & Dining" },
  { merchantPattern: "zomato", categoryName: "Food & Dining" },
  { merchantPattern: "dominos", categoryName: "Food & Dining" },
  { merchantPattern: "pizza hut", categoryName: "Food & Dining" },
  { merchantPattern: "mcdonald", categoryName: "Food & Dining" },
  { merchantPattern: "kfc", categoryName: "Food & Dining" },
  { merchantPattern: "starbucks", categoryName: "Food & Dining" },
  { merchantPattern: "cafe coffee day", categoryName: "Food & Dining" },
  { merchantPattern: "barbeque nation", categoryName: "Food & Dining" },

  // Transport
  { merchantPattern: "uber", categoryName: "Transport" },
  { merchantPattern: "ola", categoryName: "Transport" },
  { merchantPattern: "rapido", categoryName: "Transport" },
  { merchantPattern: "metro", categoryName: "Transport" },
  { merchantPattern: "indian oil", categoryName: "Transport" },
  { merchantPattern: "bharat petroleum", categoryName: "Transport" },
  { merchantPattern: "hp petrol", categoryName: "Transport" },

  // Shopping
  { merchantPattern: "amazon", categoryName: "Shopping" },
  { merchantPattern: "flipkart", categoryName: "Shopping" },
  { merchantPattern: "myntra", categoryName: "Shopping" },
  { merchantPattern: "meesho", categoryName: "Shopping" },
  { merchantPattern: "ajio", categoryName: "Shopping" },
  { merchantPattern: "nykaa", categoryName: "Shopping" },
  { merchantPattern: "snapdeal", categoryName: "Shopping" },

  // Entertainment
  { merchantPattern: "netflix", categoryName: "Entertainment" },
  { merchantPattern: "spotify", categoryName: "Entertainment" },
  { merchantPattern: "hotstar", categoryName: "Entertainment" },
  { merchantPattern: "disney", categoryName: "Entertainment" },
  { merchantPattern: "prime video", categoryName: "Entertainment" },
  { merchantPattern: "youtube premium", categoryName: "Entertainment" },
  { merchantPattern: "bookmyshow", categoryName: "Entertainment" },
  { merchantPattern: "pvr", categoryName: "Entertainment" },
  { merchantPattern: "inox", categoryName: "Entertainment" },

  // Utilities & Bills
  { merchantPattern: "airtel", categoryName: "Utilities & Bills" },
  { merchantPattern: "jio", categoryName: "Utilities & Bills" },
  { merchantPattern: "bsnl", categoryName: "Utilities & Bills" },
  { merchantPattern: "vi mobile", categoryName: "Utilities & Bills" },
  { merchantPattern: "vodafone", categoryName: "Utilities & Bills" },
  { merchantPattern: "electricity", categoryName: "Utilities & Bills" },
  { merchantPattern: "bescom", categoryName: "Utilities & Bills" },
  { merchantPattern: "tata power", categoryName: "Utilities & Bills" },
  { merchantPattern: "gas bill", categoryName: "Utilities & Bills" },
  { merchantPattern: "water bill", categoryName: "Utilities & Bills" },

  // Health & Medical
  { merchantPattern: "apollo", categoryName: "Health & Medical" },
  { merchantPattern: "medplus", categoryName: "Health & Medical" },
  { merchantPattern: "pharmeasy", categoryName: "Health & Medical" },
  { merchantPattern: "1mg", categoryName: "Health & Medical" },
  { merchantPattern: "netmeds", categoryName: "Health & Medical" },
  { merchantPattern: "fortis", categoryName: "Health & Medical" },
  { merchantPattern: "manipal hospital", categoryName: "Health & Medical" },

  // Travel
  { merchantPattern: "makemytrip", categoryName: "Travel" },
  { merchantPattern: "goibibo", categoryName: "Travel" },
  { merchantPattern: "irctc", categoryName: "Travel" },
  { merchantPattern: "cleartrip", categoryName: "Travel" },
  { merchantPattern: "yatra", categoryName: "Travel" },
  { merchantPattern: "air india", categoryName: "Travel" },
  { merchantPattern: "indigo", categoryName: "Travel" },
  { merchantPattern: "spicejet", categoryName: "Travel" },
  { merchantPattern: "oyo", categoryName: "Travel" },

  // Groceries
  { merchantPattern: "bigbasket", categoryName: "Groceries" },
  { merchantPattern: "blinkit", categoryName: "Groceries" },
  { merchantPattern: "zepto", categoryName: "Groceries" },
  { merchantPattern: "dunzo", categoryName: "Groceries" },
  { merchantPattern: "grofers", categoryName: "Groceries" },
  { merchantPattern: "d-mart", categoryName: "Groceries" },
  { merchantPattern: "reliance fresh", categoryName: "Groceries" },
  { merchantPattern: "more supermarket", categoryName: "Groceries" },

  // Education
  { merchantPattern: "byju", categoryName: "Education" },
  { merchantPattern: "unacademy", categoryName: "Education" },
  { merchantPattern: "coursera", categoryName: "Education" },
  { merchantPattern: "udemy", categoryName: "Education" },
  { merchantPattern: "vedantu", categoryName: "Education" },
  { merchantPattern: "toppr", categoryName: "Education" },
];
