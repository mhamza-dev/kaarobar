alias Kaarobar.{
  Accounts,
  Accounting,
  Billing,
  Hr,
  Inventory,
  Pos,
  Repo,
  Tenancy
}

alias Kaarobar.Schemas.{
  AttendanceRecord,
  CampaignSegment,
  Coupon,
  CrmCampaign,
  Customer,
  CustomerAccount,
  Employee,
  InventoryRecord,
  LeaveRequest,
  LoyaltyTier,
  Notification,
  Product,
  ProductBranchPrice,
  ProductImage,
  Supplier,
  User
}

import Ecto.Query
import Ecto.Changeset

IO.puts("\n=== Kaarobar demo seed (multi-owner, bulk insert_all) ===\n")

# —— Bulk helpers: validate via schema changesets, then Repo.insert_all ———

seed_now = DateTime.utc_now() |> DateTime.truncate(:second)

# Hash once — every demo login uses Password@123 (Argon2 is expensive).
demo_password_hash = Argon2.hash_pwd_salt("Password@123")

row_from_changeset! = fn changeset, extras ->
  schema = changeset.data.__struct__

  unless changeset.valid? do
    raise("""
    Invalid #{inspect(schema)} changeset
    errors: #{inspect(changeset.errors)}
    changes: #{inspect(changeset.changes)}
    """)
  end

  applied = apply_changes(changeset)
  id = Map.get(extras, :id) || Ecto.UUID.generate()

  schema.__schema__(:fields)
  |> Map.new(fn field ->
    value =
      cond do
        Map.has_key?(extras, field) -> Map.get(extras, field)
        field == :id -> id
        field in [:inserted_at, :updated_at] -> seed_now
        true -> Map.get(applied, field)
      end

    {field, value}
  end)
end

# bulk_insert!.(Schema, attrs_list, opts \\ [])
# opts: :changeset, :extras (attrs -> map), :chunk_size
bulk_insert! = fn schema_mod, attrs_list, opts ->
  attrs_list = Enum.reject(List.wrap(attrs_list), &is_nil/1)

  if attrs_list == [] do
    []
  else
    cs_fun =
      Keyword.get(opts, :changeset) || fn data, attrs -> schema_mod.changeset(data, attrs) end

    extras_fun = Keyword.get(opts, :extras) || fn _attrs -> %{} end
    chunk_size = Keyword.get(opts, :chunk_size, 500)

    rows =
      Enum.map(attrs_list, fn attrs ->
        attrs = Map.new(attrs)
        extras = extras_fun.(attrs) |> Map.new()
        cast_attrs = Map.drop(attrs, Map.keys(extras))
        cs = cs_fun.(struct(schema_mod), cast_attrs)
        row_from_changeset!.(cs, extras)
      end)

    rows
    |> Enum.chunk_every(chunk_size)
    |> Enum.each(fn chunk -> Repo.insert_all(schema_mod, chunk) end)

    Enum.map(rows, &struct(schema_mod, &1))
  end
end

# —— Stock imagery (absolute URLs stored as storage/profile keys) ———

portrait_pool = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&auto=format"
]

product_image_by_sku = %{
  "TEA-001" =>
    "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=600&fit=crop&auto=format",
  "RCE-010" =>
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&h=600&fit=crop&auto=format",
  "OIL-003" =>
    "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&h=600&fit=crop&auto=format",
  "MLK-002" =>
    "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&h=600&fit=crop&auto=format",
  "BISC-12" =>
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&h=600&fit=crop&auto=format",
  "SOAP-01" =>
    "https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?w=600&h=600&fit=crop&auto=format",
  "SHMP-02" =>
    "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=600&h=600&fit=crop&auto=format",
  "WTR-01" =>
    "https://images.unsplash.com/photo-1548839140-29a749de1c4e?w=600&h=600&fit=crop&auto=format",
  "CHF-01" =>
    "https://images.unsplash.com/photo-1596040033229-a9822f1cfcdd?w=600&h=600&fit=crop&auto=format",
  "NDL-02" =>
    "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=600&fit=crop&auto=format",
  "MED-01" =>
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=600&fit=crop&auto=format",
  "MED-02" =>
    "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&h=600&fit=crop&auto=format",
  "FOOD-01" =>
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=600&fit=crop&auto=format",
  "FOOD-02" =>
    "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=600&fit=crop&auto=format",
  "FOOD-03" =>
    "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&h=600&fit=crop&auto=format",
  "SVC-CUT" =>
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&h=600&fit=crop&auto=format",
  "SVC-COLOR" =>
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=600&fit=crop&auto=format",
  "SVC-NAIL" =>
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&h=600&fit=crop&auto=format",
  "CTN-01" =>
    "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop&auto=format",
  "CTN-02" =>
    "https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&h=600&fit=crop&auto=format"
}

portrait_for = fn key ->
  Enum.at(portrait_pool, rem(:erlang.phash2(key), length(portrait_pool)))
end

product_image_for = fn sku ->
  Map.get(product_image_by_sku, sku) ||
    "https://picsum.photos/seed/#{sku}/600/600"
end

# —— Catalogs ————————————————————————————————————————————————————

base_catalog = [
  %{
    sku: "TEA-001",
    barcode: "8901001100011",
    name: "Green Tea 250g",
    category: "grocery",
    price: "450",
    qty: "80"
  },
  %{
    sku: "RCE-010",
    barcode: "8901001100028",
    name: "Basmati Rice 5kg",
    category: "grocery",
    price: "1850",
    qty: "40"
  },
  %{
    sku: "OIL-003",
    barcode: "8901001100035",
    name: "Cooking Oil 1L",
    category: "grocery",
    price: "620",
    qty: "55"
  },
  %{
    sku: "MLK-002",
    barcode: "8901001100042",
    name: "Full Cream Milk 1L",
    category: "dairy",
    price: "280",
    qty: "60"
  },
  %{
    sku: "BISC-12",
    barcode: "8901001100059",
    name: "Cream Biscuits Pack",
    category: "snacks",
    price: "150",
    qty: "100"
  },
  %{
    sku: "SOAP-01",
    barcode: "8901001100066",
    name: "Bath Soap 3pc",
    category: "personal-care",
    price: "220",
    qty: "70"
  },
  %{
    sku: "SHMP-02",
    barcode: "8901001100073",
    name: "Shampoo 200ml",
    category: "personal-care",
    price: "480",
    qty: "35"
  },
  %{
    sku: "WTR-01",
    barcode: "8901001100080",
    name: "Mineral Water 1.5L",
    category: "beverages",
    price: "90",
    qty: "120"
  },
  %{
    sku: "CHF-01",
    barcode: "8901001100097",
    name: "Chai Masala 100g",
    category: "grocery",
    price: "180",
    qty: "50"
  },
  %{
    sku: "NDL-02",
    barcode: "8901001100103",
    name: "Instant Noodles 5pk",
    category: "snacks",
    price: "320",
    qty: "75"
  }
]

# Bulk grocery / retail SKUs so POS grids and inventory lists feel full.
extra_product_templates = [
  {"SUG", "Sugar 1kg", "grocery", "220"},
  {"FLT", "Wheat Flour 10kg", "grocery", "1450"},
  {"DAL", "Moong Dal 1kg", "grocery", "380"},
  {"SLT", "Iodized Salt 800g", "grocery", "75"},
  {"TSP", "Tomato Ketchup 500g", "grocery", "310"},
  {"JAM", "Mixed Fruit Jam 450g", "grocery", "420"},
  {"HNY", "Natural Honey 250g", "grocery", "650"},
  {"EGG", "Farm Eggs Dozen", "dairy", "360"},
  {"YGT", "Yogurt Cup 400g", "dairy", "190"},
  {"BTR", "Butter 200g", "dairy", "480"},
  {"CHS", "Cheddar Cheese 200g", "dairy", "720"},
  {"CDF", "Condensed Milk Tin", "dairy", "290"},
  {"CHF2", "Black Pepper 50g", "grocery", "160"},
  {"SPN", "Red Chilli Powder 200g", "grocery", "240"},
  {"TUR", "Turmeric 100g", "grocery", "130"},
  {"RCE2", "Sella Rice 1kg", "grocery", "320"},
  {"RCE3", "Broken Rice 5kg", "grocery", "980"},
  {"OIL2", "Mustard Oil 500ml", "grocery", "410"},
  {"OIL3", "Olive Oil 250ml", "grocery", "980"},
  {"TEA2", "Kashmiri Tea 250g", "beverages", "520"},
  {"TEA3", "Coffee Classic 100g", "beverages", "780"},
  {"JUC", "Mango Juice 1L", "beverages", "260"},
  {"SOD", "Cola 1.5L", "beverages", "180"},
  {"NRG", "Energy Drink 250ml", "beverages", "220"},
  {"CHIP", "Potato Chips 70g", "snacks", "80"},
  {"NUT", "Salted Peanuts 200g", "snacks", "210"},
  {"CHK", "Chocolate Bar 40g", "snacks", "120"},
  {"CND", "Hard Candy Pack", "snacks", "90"},
  {"BIC2", "Digestive Biscuits", "snacks", "180"},
  {"NDL3", "Cup Noodles", "snacks", "140"},
  {"SOAP2", "Hand Wash 250ml", "personal-care", "280"},
  {"TTH", "Toothpaste 100g", "personal-care", "210"},
  {"TBR", "Toothbrush Twin", "personal-care", "160"},
  {"DTR", "Detergent 1kg", "household", "390"},
  {"DSW", "Dish Wash 500ml", "household", "250"},
  {"TIS", "Tissue Box", "household", "180"},
  {"BAG", "Garbage Bags Roll", "household", "220"},
  {"BLB", "LED Bulb 12W", "household", "340"},
  {"BAT", "AA Batteries 4pk", "household", "280"},
  {"NAP", "Baby Diapers M", "baby", "1450"},
  {"WPE", "Baby Wipes Pack", "baby", "320"},
  {"PET", "Cat Food 1kg", "pet", "980"},
  {"FRZ", "Frozen Paratha 10pc", "frozen", "450"},
  {"ICE", "Vanilla Ice Cream 1L", "frozen", "680"},
  {"BRD", "Sandwich Bread", "bakery", "160"},
  {"BNN", "Bananas 1kg", "produce", "180"},
  {"APP", "Apples 1kg", "produce", "350"},
  {"ONI", "Onions 1kg", "produce", "120"},
  {"POT", "Potatoes 1kg", "produce", "90"},
  {"TMT", "Tomatoes 1kg", "produce", "140"}
]

generated_base_catalog =
  Enum.with_index(extra_product_templates, 1)
  |> Enum.map(fn {{code, name, category, price}, i} ->
    %{
      sku: "#{code}-#{String.pad_leading("#{i}", 3, "0")}",
      barcode: "8901#{String.pad_leading("#{100_100 + i}", 7, "0")}",
      name: name,
      category: category,
      price: price,
      qty: "#{35 + rem(i * 11, 90)}"
    }
  end)

base_catalog = base_catalog ++ generated_base_catalog

industry_extras = %{
  "pharmacy" => [
    %{
      sku: "MED-01",
      barcode: "8902001100018",
      name: "Paracetamol 500mg",
      category: "OTC",
      price: "60",
      qty: "200",
      product_kind: "goods"
    },
    %{
      sku: "MED-02",
      barcode: "8902001100025",
      name: "ORS Sachet Pack",
      category: "OTC",
      price: "120",
      qty: "150",
      product_kind: "goods"
    }
  ] ++
    Enum.map(1..18, fn i ->
      %{
        sku: "MED-X#{String.pad_leading("#{i}", 2, "0")}",
        barcode: "89020011#{String.pad_leading("#{100 + i}", 4, "0")}",
        name: Enum.at(
          [
            "Vitamin C 500mg",
            "Cough Syrup 100ml",
            "Antacid Tablets",
            "Antiseptic Cream",
            "Bandage Roll",
            "Digital Thermometer",
            "Face Mask Pack 50",
            "Hand Sanitizer 250ml",
            "Multivitamin Adults",
            "Iron Syrup 200ml",
            "Calcium Tablets",
            "Allergy Relief 10mg",
            "Eye Drops 10ml",
            "Pain Relief Gel",
            "Glucose Powder 400g",
            "Baby Formula 400g",
            "Pregnancy Test Kit",
            "BP Monitor Cuff"
          ],
          i - 1
        ),
        category: Enum.at(["OTC", "Rx", "Devices", "Wellness"], rem(i, 4)),
        price: "#{80 + i * 35}",
        qty: "#{80 + rem(i * 13, 120)}",
        product_kind: "goods"
      }
    end),
  "restaurant" => [
    %{
      sku: "FOOD-01",
      barcode: "8903001100015",
      name: "Chicken Karahi (portion)",
      category: "Food",
      price: "850",
      qty: "40",
      product_kind: "goods"
    },
    %{
      sku: "FOOD-02",
      barcode: "8903001100022",
      name: "Biryani Plate",
      category: "Food",
      price: "450",
      qty: "60",
      product_kind: "goods"
    },
    %{
      sku: "FOOD-03",
      barcode: "8903001100039",
      name: "Fresh Lime",
      category: "Beverages",
      price: "180",
      qty: "80",
      product_kind: "goods"
    }
  ] ++
    Enum.map(1..15, fn i ->
      %{
        sku: "FOOD-X#{String.pad_leading("#{i}", 2, "0")}",
        barcode: "89030011#{String.pad_leading("#{100 + i}", 4, "0")}",
        name: Enum.at(
          [
            "Chicken Tikka",
            "Seekh Kebab Plate",
            "Daal Mash Bowl",
            "Naan Basket",
            "Garlic Naan",
            "Mutton Pulao",
            "Fish Fry",
            "Club Sandwich",
            "French Fries",
            "Chicken Burger",
            "Mint Margarita",
            "Kashmiri Chai",
            "Soft Drink Can",
            "Raita Cup",
            "Gulab Jamun 2pc"
          ],
          i - 1
        ),
        category: Enum.at(["Food", "Sides", "Beverages", "Dessert"], rem(i, 4)),
        price: "#{220 + i * 55}",
        qty: "#{30 + rem(i * 9, 50)}",
        product_kind: "goods"
      }
    end),
  "salon" => [
    %{
      sku: "SVC-CUT",
      barcode: "8904001100012",
      name: "Haircut",
      category: "Hair",
      price: "800",
      qty: "0",
      product_kind: "service",
      duration_minutes: 30,
      track_inventory: false
    },
    %{
      sku: "SVC-COLOR",
      barcode: "8904001100029",
      name: "Hair Color",
      category: "Hair",
      price: "3500",
      qty: "0",
      product_kind: "service",
      duration_minutes: 90,
      track_inventory: false
    },
    %{
      sku: "SVC-NAIL",
      barcode: "8904001100036",
      name: "Manicure",
      category: "Nails",
      price: "1200",
      qty: "0",
      product_kind: "service",
      duration_minutes: 45,
      track_inventory: false
    }
  ] ++
    Enum.map(1..10, fn i ->
      %{
        sku: "SVC-X#{String.pad_leading("#{i}", 2, "0")}",
        barcode: "89040011#{String.pad_leading("#{100 + i}", 4, "0")}",
        name: Enum.at(
          [
            "Beard Trim",
            "Hair Wash & Blow",
            "Facial Classic",
            "Facial Gold",
            "Pedicure",
            "Eyebrow Threading",
            "Head Massage",
            "Keratin Treatment",
            "Bridal Makeup Trial",
            "Kids Haircut"
          ],
          i - 1
        ),
        category: Enum.at(["Hair", "Skin", "Nails", "Spa"], rem(i, 4)),
        price: "#{900 + i * 250}",
        qty: "0",
        product_kind: "service",
        duration_minutes: 20 + i * 10,
        track_inventory: false
      }
    end),
  "wholesale" => [
    %{
      sku: "CTN-01",
      barcode: "8905001100019",
      name: "Carton Tape Roll",
      category: "Bulk",
      price: "95",
      qty: "300"
    },
    %{
      sku: "CTN-02",
      barcode: "8905001100026",
      name: "Packing Boxes (10)",
      category: "Cases",
      price: "780",
      qty: "90"
    }
  ] ++
    Enum.map(1..12, fn i ->
      %{
        sku: "CTN-X#{String.pad_leading("#{i}", 2, "0")}",
        barcode: "89050011#{String.pad_leading("#{100 + i}", 4, "0")}",
        name: Enum.at(
          [
            "Stretch Wrap Roll",
            "Pallet Wrap Heavy",
            "Corrugated Sheets",
            "Bubble Wrap 50m",
            "Shipping Labels 500",
            "Marker Carton Pack",
            "Cable Ties 100pc",
            "Hand Strapping Kit",
            "Bulk Gloves Carton",
            "Floor Cleaner 5L",
            "Bulk Sugar Sack 50kg",
            "Rice Bag 25kg"
          ],
          i - 1
        ),
        category: Enum.at(["Bulk", "Cases", "Packaging", "Consumables"], rem(i, 4)),
        price: "#{150 + i * 90}",
        qty: "#{100 + i * 25}"
      }
    end)
}

cities = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Faisalabad",
  "Rawalpindi",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Sukkur",
  "Abbottabad",
  "Bahawalpur",
  "Sargodha",
  "Sheikhupura",
  "Jhelum",
  "Sahiwal",
  "Mardan",
  "Gujrat",
  "Okara",
  "Kasur",
  "Attock",
  "Swat"
]

branch_suffixes = [
  "Main",
  "Mall",
  "Market",
  "Highway",
  "Township",
  "Cantt",
  "Airport",
  "University"
]

employee_names = [
  "Hassan Ali",
  "Fatima Noor",
  "Usman Raza",
  "Zara Khan",
  "Omar Siddiqui",
  "Amina Bibi",
  "Bilal Hussain",
  "Sana Iqbal",
  "Hamza Farooq",
  "Maria Ahmed",
  "Imran Shah",
  "Nadia Malik",
  "Tariq Mehmood",
  "Hina Bashir",
  "Saad Qureshi",
  "Rabia Anwar",
  "Danish Iqbal",
  "Komal Sheikh",
  "Waleed Ashraf",
  "Mehwish Rauf",
  "Asad Javed",
  "Iqra Naveed",
  "Shahzad Alam",
  "Ayesha Kamran"
]

positions = [
  "Cashier",
  "Sales Associate",
  "Store Keeper",
  "Supervisor",
  "Stock Clerk",
  "Floor Manager",
  "Delivery Lead",
  "Accounts Assistant"
]

customer_defs = [
  %{
    name: "Walk-in Retail",
    phone: "+923001110001",
    email: "walkin@example.pk",
    khata_enabled: false,
    loyalty_points: 0,
    marketing_opt_in_email: false,
    marketing_opt_in_sms: false,
    marketing_opt_in_whatsapp: false,
    company_name: nil,
    address: "Cash counter"
  },
  %{
    name: "Corner Shop Credit",
    phone: "+923001110002",
    email: "cornershop@kaarobar-demo.pk",
    khata_enabled: true,
    loyalty_points: 120,
    marketing_opt_in_email: true,
    marketing_opt_in_sms: true,
    marketing_opt_in_whatsapp: false,
    company_name: "Corner Shop",
    address: "Model Town Market, Lahore",
    credit_limit: "50000",
    cnic: "35202-1234567-1"
  },
  %{
    name: "Hotel Supplies Co",
    phone: "+923001110003",
    email: "procurement@hotelsupplies.pk",
    khata_enabled: true,
    loyalty_points: 850,
    marketing_opt_in_email: true,
    marketing_opt_in_sms: false,
    marketing_opt_in_whatsapp: true,
    company_name: "Hotel Supplies Co (Pvt) Ltd",
    address: "Industrial Area, Kot Lakhpat",
    credit_limit: "250000",
    ntn: "1234567-8",
    portal: true,
    portal_password: "Password@123"
  },
  %{
    name: "Neighborhood Clinic",
    phone: "+923001110004",
    email: "admin@neighborhoodclinic.pk",
    khata_enabled: true,
    loyalty_points: 420,
    marketing_opt_in_email: true,
    marketing_opt_in_sms: true,
    marketing_opt_in_whatsapp: true,
    company_name: "Neighborhood Clinic",
    address: "Main Boulevard, Gulberg",
    credit_limit: "100000",
    portal: true,
    portal_password: "Password@123"
  },
  %{
    name: "Ayesha Siddiqui",
    phone: "+923001110005",
    email: "ayesha.customer@kaarobar-demo.pk",
    khata_enabled: false,
    loyalty_points: 45,
    marketing_opt_in_email: true,
    marketing_opt_in_sms: true,
    marketing_opt_in_whatsapp: true,
    company_name: nil,
    address: "DHA Phase 5",
    portal: true,
    portal_password: "Password@123"
  },
  %{
    name: "Raza Traders",
    phone: "+923001110006",
    email: "raza.traders@kaarobar-demo.pk",
    khata_enabled: true,
    loyalty_points: 2100,
    marketing_opt_in_email: true,
    marketing_opt_in_sms: false,
    marketing_opt_in_whatsapp: false,
    company_name: "Raza Traders",
    address: "Hall Road, Lahore",
    credit_limit: "500000",
    portal: true,
    portal_password: "Password@123"
  }
]

# Extra customers for denser CRM / POS attach lists (idempotent by name).
customer_name_pool = [
  "Bilal Corner Store",
  "Saima Household",
  "Khan Medical Mart",
  "Sunrise Bakery",
  "Pearl Guest House",
  "Green Leaf Cafe",
  "Office Supplies Hub",
  "City Auto Workshop",
  "Fatima Apparel",
  "Noor Electronics",
  "Hassan Dairy Point",
  "Iqbal Stationery",
  "Mehmood Hardware",
  "Amina Beauty Lounge",
  "Rizwan Mobile Zone",
  "Sana Grocery Point",
  "Usman Fresh Meat",
  "Zoya Boutique",
  "Tariq Tea Stall",
  "Hina Kids Wear",
  "Waqas Print Shop",
  "Nadia Dry Cleaners",
  "Farhan Optics",
  "Komal Florist",
  "Danish Sports Gear",
  "Rabia Home Decor",
  "Shahid Tyre Shop",
  "Areeba Cosmetics",
  "Junaid Watch Co",
  "Lubna Spice House",
  "Kamran Book Corner",
  "Sadia Laundry",
  "Imtiaz Juice Bar",
  "Nimra Gift Gallery",
  "Owais Pet Care",
  "Hira Fashion Hub",
  "Yasir Tools Mart",
  "Mahnoor Sweets",
  "Faisal Ice Depot",
  "Bushra Tailors",
  "Arslan Cable Net",
  "Saba Nutrition",
  "Noman Battery Shop",
  "Iqra Pharmacy Link",
  "Rehan Furniture",
  "Asma Bridal Studio",
  "Kashif Gas Agency",
  "Zainab Crockery"
]

generated_customers =
  Enum.with_index(customer_name_pool, 7)
  |> Enum.map(fn {name, i} ->
    khata? = rem(i, 3) != 0
    portal? = rem(i, 7) == 0

    %{
      name: name,
      phone: "+92300#{1_110_000 + i}",
      email: "customer#{i}@kaarobar-demo.pk",
      khata_enabled: khata?,
      loyalty_points: rem(i * 37, 2500),
      marketing_opt_in_email: rem(i, 2) == 0,
      marketing_opt_in_sms: rem(i, 3) == 0,
      marketing_opt_in_whatsapp: rem(i, 4) == 0,
      company_name: if(rem(i, 2) == 0, do: name, else: nil),
      address: "#{Enum.at(cities, rem(i, length(cities)))} Block #{rem(i, 12) + 1}",
      credit_limit: if(khata?, do: "#{25_000 + i * 5_000}", else: nil),
      portal: portal?,
      portal_password: if(portal?, do: "Password@123", else: nil)
    }
  end)

customer_defs = customer_defs ++ generated_customers

business_pool = [
  {"Al-Falah Traders", "retail", false},
  {"Noor Mart", "supermarket", true},
  {"City Pharmacy", "pharmacy", false},
  {"Spice Route Wholesale", "wholesale", false},
  {"Karachi Cafe Co", "restaurant", false},
  {"Green Valley Grocers", "retail", false},
  {"Pak Hardware Hub", "retail", false},
  {"Sunrise Textiles", "retail", true},
  {"Desert Bloom Pharmacy", "pharmacy", false},
  {"Indus Auto Parts", "wholesale", false},
  {"Himalaya Dairy Points", "retail", false},
  {"Coastal Fresh Foods", "supermarket", true},
  {"Punjab Book Stall", "retail", false},
  {"Silk Road Traders", "wholesale", false},
  {"Capital Electronics", "retail", false},
  {"Frontier Medical Store", "pharmacy", false},
  {"Canal View Cafe", "restaurant", false},
  {"Oasis Superstore", "supermarket", false},
  {"Makran Marine Supplies", "wholesale", false},
  {"Chinar Gift Shop", "retail", false},
  {"Gulberg Fashion Hub", "retail", false},
  {"Riverbend Pharmacy", "pharmacy", true},
  {"Metro Fresh Foods", "supermarket", false},
  {"Khyber Wholesale Depot", "wholesale", false},
  {"Saffron Kitchen", "restaurant", false},
  {"Pearl Electronics", "retail", false},
  {"Valley Dairy Mart", "retail", false},
  {"Quetta Dry Fruits Co", "wholesale", false},
  {"Liberty Cafe", "restaurant", false},
  {"Glow Studio Salon", "salon", false},
  {"Style Lab Beauty", "salon", true},
  {"Aabpara Medicos", "pharmacy", false},
  {"Neighborhood General", "general", false}
]

# Each owner: 1–6 businesses
owner_defs = [
  %{
    email: "owner@kaarobar.local",
    name: "Demo Owner",
    phone: "+923001234567",
    plan: "enterprise",
    business_count: 6,
    staff_prefix: ""
  },
  %{
    email: "owner2@kaarobar.local",
    name: "Sara Malik",
    phone: "+923001112233",
    plan: "growth",
    business_count: 4,
    staff_prefix: "2"
  },
  %{
    email: "owner3@kaarobar.local",
    name: "Imtiaz Ahmed",
    phone: "+923004445566",
    plan: "starter",
    business_count: 2,
    staff_prefix: "3"
  },
  %{
    email: "owner4@kaarobar.local",
    name: "Nadia Qureshi",
    phone: "+923007778899",
    plan: "trial",
    business_count: 1,
    staff_prefix: "4"
  }
]

staff_role_defs = [
  {"admin", "Admin User", ["admin"]},
  {"manager", "Ayesha Khan", ["branch_manager"]},
  {"cashier", "Bilal Ahmed", ["cashier"]},
  {"accountant", "Sana Malik", ["accountant"]},
  {"hr", "Imran Ali", ["hr_manager"]},
  {"inventory", "Nadia Raza", ["inventory_manager"]},
  {"employee", "Ali Worker", ["employee"]}
]

# Trial plans have tight user seats — only seed portal-critical staff there.
staff_roles_for_plan = fn
  "trial" ->
    Enum.filter(staff_role_defs, fn {role, _, _} -> role in ~w(admin cashier employee) end)

  _ ->
    staff_role_defs
end

# Roles that need a home branch for POS / ESS clock-in
branch_scoped_roles = MapSet.new(["admin", "cashier", "employee"])

ensure_user = fn email, name, phone ->
  case Accounts.get_user_by_email(email) do
    %User{} = user ->
      updates =
        %{}
        |> then(fn m ->
          if user.mfa_required and user.email != "owner@kaarobar.local",
            do: Map.put(m, :mfa_required, false),
            else: m
        end)
        |> then(fn m ->
          if is_nil(user.profile_pic_key) or user.profile_pic_key == "",
            do: Map.put(m, :profile_pic_key, portrait_for.({:user, email})),
            else: m
        end)

      if map_size(updates) > 0 do
        {:ok, updated} = user |> change(updates) |> Repo.update()
        updated
      else
        user
      end

    nil ->
      [user] =
        bulk_insert!.(
          User,
          [
            %{
              email: email,
              name: name,
              phone: phone,
              locale: "en",
              status: "active",
              profile_pic_key: portrait_for.({:user, email})
            }
          ],
          extras: fn attrs ->
            %{
              password_hash: demo_password_hash,
              mfa_required: false,
              confirmed_at: seed_now,
              profile_pic_key: attrs.profile_pic_key
            }
          end
        )

      user
  end
end

ensure_membership = fn actor, business, user, roles, branch_id ->
  existing =
    if is_nil(branch_id) do
      from(m in Kaarobar.Schemas.Membership,
        where: m.user_id == ^user.id and m.business_id == ^business.id and is_nil(m.branch_id)
      )
      |> Repo.one()
    else
      from(m in Kaarobar.Schemas.Membership,
        where:
          m.user_id == ^user.id and m.business_id == ^business.id and m.branch_id == ^branch_id
      )
      |> Repo.one()
    end

  cond do
    existing && Enum.sort(existing.roles || []) == Enum.sort(roles) && existing.status == "active" ->
      existing

    existing ->
      case Tenancy.update_membership(existing.id, actor, %{roles: roles, status: "active"}) do
        {:ok, m} ->
          m

        {:error, reason} ->
          IO.puts("    ! membership update #{user.email}: #{inspect(reason)}")
          existing
      end

    true ->
      case Tenancy.create_membership(actor, %{
             user_id: user.id,
             business_id: business.id,
             branch_id: branch_id,
             roles: roles,
             status: "active"
           }) do
        {:ok, m} ->
          m

        {:error, :plan_limit_reached} ->
          IO.puts("    ! user limit — skip #{user.email} on #{business.name}")
          nil

        {:error, reason} ->
          IO.puts("    ! membership #{user.email}: #{inspect(reason)}")
          nil
      end
  end
end

catalog_for = fn industry ->
  base_catalog ++ Map.get(industry_extras, industry, [])
end

seed_products = fn owner, business, branches, catalog ->
  existing_by_sku =
    from(p in Product, where: p.business_id == ^business.id)
    |> Repo.all()
    |> Map.new(&{&1.sku, &1})

  new_product_attrs =
    catalog
    |> Enum.reject(fn p -> Map.has_key?(existing_by_sku, p.sku) end)
    |> Enum.map(fn p ->
      %{
        sku: p.sku,
        name: p.name,
        category: p.category,
        barcode: Map.get(p, :barcode),
        product_kind: Map.get(p, :product_kind, "goods"),
        track_inventory: Map.get(p, :track_inventory, true),
        duration_minutes: Map.get(p, :duration_minutes),
        unit: Map.get(p, :unit, "pcs"),
        tax_rate: "0.18",
        is_active: true,
        business_id: business.id,
        owner_id: owner.id
      }
    end)

  inserted = bulk_insert!.(Product, new_product_attrs, [])

  products =
    catalog
    |> Enum.map(fn p ->
      Map.get(existing_by_sku, p.sku) || Enum.find(inserted, &(&1.sku == p.sku))
    end)
    |> Enum.reject(&is_nil/1)

  # Pharmacy batches / restaurant variants (rare — keep context helpers)
  Enum.each(products, fn product ->
    p = Enum.find(catalog, &(&1.sku == product.sku))

    if (p && business.industry == "pharmacy") and String.starts_with?(p.sku, "MED") and
         product.id in Enum.map(inserted, & &1.id) do
      Enum.each(branches, fn branch ->
        _ =
          Kaarobar.Catalog.create_batch(product, branch.id, %{
            lot_number: "LOT-#{p.sku}-A",
            expires_on: Date.add(Date.utc_today(), 365),
            quantity_on_hand: p.qty,
            cost: Decimal.div(Decimal.new(p.price), Decimal.new("2")) |> Decimal.round(2)
          })
      end)
    end

    if (p && business.industry == "restaurant") and p.sku == "FOOD-02" and
         product.id in Enum.map(inserted, & &1.id) do
      _ =
        Kaarobar.Catalog.create_variant(product, %{
          name: "Half",
          sku: "FOOD-02-H",
          barcode: "8903001100022H",
          price_override: "280"
        })

      _ =
        Kaarobar.Catalog.create_variant(product, %{
          name: "Full",
          sku: "FOOD-02-F",
          barcode: "8903001100022F",
          price_override: "450"
        })
    end
  end)

  existing_prices =
    from(pr in ProductBranchPrice, where: pr.business_id == ^business.id)
    |> Repo.all()
    |> MapSet.new(&{&1.product_id, &1.branch_id})

  existing_inv =
    from(i in InventoryRecord, where: i.business_id == ^business.id)
    |> Repo.all()
    |> MapSet.new(&{&1.product_id, &1.branch_id})

  existing_image_product_ids =
    from(i in ProductImage,
      where: i.business_id == ^business.id and i.is_primary == true,
      select: i.product_id
    )
    |> Repo.all()
    |> MapSet.new()

  {price_attrs, inv_attrs, image_attrs} =
    Enum.reduce(products, {[], [], []}, fn product, {prices, invs, images} ->
      p = Enum.find(catalog, &(&1.sku == product.sku)) || %{price: "100", qty: "0"}

      {prices, invs} =
        Enum.with_index(branches)
        |> Enum.reduce({prices, invs}, fn {branch, bidx}, {ps, is} ->
          bump = Decimal.new(rem(bidx * 7 + :erlang.phash2({branch.id, product.sku}, 25), 25))
          price = Decimal.add(Decimal.new(p.price), bump) |> Decimal.round(0)

          ps =
            if MapSet.member?(existing_prices, {product.id, branch.id}) do
              ps
            else
              [
                %{
                  product_id: product.id,
                  branch_id: branch.id,
                  owner_id: owner.id,
                  business_id: business.id,
                  price: price
                }
                | ps
              ]
            end

          track? =
            Map.get(p, :track_inventory, true) != false and Map.get(p, :product_kind) != "service"

          is =
            if not track? or MapSet.member?(existing_inv, {product.id, branch.id}) do
              is
            else
              qty = Decimal.add(Decimal.new(p.qty), Decimal.new(10 + rem(bidx * 11, 40)))

              [
                %{
                  branch_id: branch.id,
                  product_id: product.id,
                  owner_id: owner.id,
                  business_id: business.id,
                  quantity_on_hand: qty,
                  avg_cost: price |> Decimal.div(Decimal.new("1.25")) |> Decimal.round(2)
                }
                | is
              ]
            end

          {ps, is}
        end)

      images =
        if MapSet.member?(existing_image_product_ids, product.id) do
          images
        else
          [
            %{
              product_id: product.id,
              business_id: business.id,
              owner_id: owner.id,
              storage_key: product_image_for.(product.sku),
              content_type: "image/jpeg",
              byte_size: 0,
              is_primary: true,
              sort_order: 0
            }
            | images
          ]
        end

      {prices, invs, images}
    end)

  _ = bulk_insert!.(ProductBranchPrice, price_attrs, [])
  _ = bulk_insert!.(InventoryRecord, inv_attrs, [])
  _ = bulk_insert!.(ProductImage, image_attrs, [])

  products
end

supplier_defs = [
  %{
    name: "Lahore Distributors",
    legal_name: "Lahore Distributors (Pvt) Ltd",
    code: "LHR-DIST",
    tax_id: "1234567-8",
    strn: "32-77-1234-567-89",
    industry: "FMCG wholesale",
    contact_name: "Ahmed Raza",
    contact_role: "Key Account Manager",
    contact_email: "ahmed@lahoredist.pk",
    contact_phone: "+92 42 35789000",
    contact_mobile: "+92 300 1234567",
    contact_whatsapp: "+92 300 1234567",
    city: "Lahore",
    province: "Punjab",
    address_line1: "Plot 12, Bund Road",
    payment_terms: "Net 15",
    payment_method: "bank_transfer",
    bank_name: "HBL",
    bank_iban: "PK00HABB0000123456789012",
    bank_account_title: "Lahore Distributors Pvt Ltd",
    credit_limit: "500000",
    lead_time_days: 3,
    catalogs: ["beverages", "snacks", "dairy"],
    brands: ["Nestle", "Pepsi"],
    tags: ["preferred", "fmcg"],
    is_preferred: true,
    rating: 5
  },
  %{
    name: "National Supply Co",
    legal_name: "National Supply Company",
    code: "NAT-SUP",
    tax_id: "2345678-9",
    industry: "General wholesale",
    contact_name: "Sana Malik",
    contact_role: "Sales Director",
    contact_email: "sana@nationalsupply.pk",
    contact_phone: "+92 51 111222333",
    contact_mobile: "+92 333 7654321",
    city: "Islamabad",
    province: "Islamabad Capital Territory",
    address_line1: "I-9 Industrial Area",
    payment_terms: "Net 30",
    payment_method: "bank_transfer",
    credit_limit: "1000000",
    lead_time_days: 5,
    catalogs: ["grocery", "household", "personal care"],
    brands: ["Unilever", "P&G"],
    tags: ["national"],
    is_preferred: true,
    rating: 4
  },
  %{
    name: "Local Cash & Carry",
    legal_name: "Local Cash and Carry Traders",
    code: "LCC-01",
    industry: "Cash & carry",
    contact_name: "Bilal Khan",
    contact_role: "Owner",
    contact_email: "orders@localcc.pk",
    contact_phone: "+92 21 34567890",
    contact_mobile: "+92 321 1112233",
    city: "Karachi",
    province: "Sindh",
    address_line1: "Saddar Wholesale Market",
    payment_terms: "Net 7",
    payment_method: "cash",
    credit_limit: "100000",
    lead_time_days: 1,
    catalogs: ["grocery", "spices"],
    brands: [],
    tags: ["local", "fast"],
    rating: 3
  },
  %{
    name: "Punjab Wholesalers",
    legal_name: "Punjab Wholesalers Concern",
    code: "PUN-WH",
    tax_id: "3456789-0",
    strn: "03-04-9876-543-21",
    industry: "Regional wholesale",
    contact_name: "Farah Iqbal",
    contact_role: "Procurement Lead",
    contact_email: "farah@punjabwholesalers.pk",
    contact_phone: "+92 41 2667788",
    contact_mobile: "+92 345 9988776",
    contact_whatsapp: "+92 345 9988776",
    city: "Faisalabad",
    province: "Punjab",
    address_line1: "Susan Road Market",
    payment_terms: "Net 15",
    payment_method: "cheque",
    bank_name: "Meezan Bank",
    bank_iban: "PK00MEZN0000987654321098",
    bank_account_title: "Punjab Wholesalers",
    credit_limit: "350000",
    lead_time_days: 4,
    catalogs: ["textile", "home", "grocery"],
    brands: ["Local Mills"],
    tags: ["punjab"],
    rating: 4
  }
]

generated_suppliers =
  Enum.map(1..12, fn i ->
    city = Enum.at(cities, rem(i + 3, length(cities)))

    %{
      name: "Supplier #{i} · #{city}",
      legal_name: "Supplier #{i} Trading Co",
      code: "SUP-X#{String.pad_leading("#{i}", 2, "0")}",
      tax_id: "#{4_000_000 + i}-#{rem(i, 9)}",
      industry: Enum.at(["FMCG wholesale", "General wholesale", "Regional wholesale", "Cash & carry"], rem(i, 4)),
      contact_name: Enum.at(employee_names, rem(i, length(employee_names))),
      contact_role: "Sales",
      contact_email: "orders#{i}@supplier-demo.pk",
      contact_phone: "+9242#{3_500_000 + i}",
      contact_mobile: "+92300#{1_200_000 + i}",
      city: city,
      province: "Punjab",
      address_line1: "Warehouse #{i}, Industrial Area",
      payment_terms: Enum.at(["Net 7", "Net 15", "Net 30"], rem(i, 3)),
      payment_method: Enum.at(["bank_transfer", "cash", "cheque"], rem(i, 3)),
      credit_limit: "#{100_000 + i * 50_000}",
      lead_time_days: 1 + rem(i, 7),
      catalogs: ["grocery", "household"],
      brands: ["Local"],
      tags: ["seed", "bulk"],
      rating: 2 + rem(i, 4)
    }
  end)

supplier_defs = supplier_defs ++ generated_suppliers

seed_suppliers = fn owner, business ->
  existing_names =
    from(s in Supplier, where: s.business_id == ^business.id, select: s.name)
    |> Repo.all()
    |> MapSet.new()

  attrs =
    supplier_defs
    |> Enum.reject(fn defn -> MapSet.member?(existing_names, defn.name) end)
    |> Enum.map(fn defn ->
      defn
      |> Map.merge(%{
        business_id: business.id,
        owner_id: owner.id,
        country: "PK",
        currency: "PKR",
        status: Map.get(defn, :status, "active"),
        contact: %{
          phone: defn[:contact_phone],
          email: defn[:contact_email]
        }
      })
    end)

  bulk_insert!.(Supplier, attrs, [])
  :ok
end

seed_customers = fn owner, business ->
  existing_by_name =
    from(c in Customer, where: c.business_id == ^business.id)
    |> Repo.all()
    |> Map.new(&{&1.name, &1})

  attrs =
    customer_defs
    |> Enum.with_index()
    |> Enum.reject(fn {defn, _} -> Map.has_key?(existing_by_name, defn.name) end)
    |> Enum.map(fn {defn, idx} ->
      %{
        name: defn.name,
        phone:
          defn.phone || "+92300#{1_000_000 + :erlang.phash2({business.id, defn.name}, 8_999_999)}",
        email: defn[:email],
        address: defn[:address],
        company_name: defn[:company_name],
        credit_limit: defn[:credit_limit],
        cnic: defn[:cnic],
        ntn: defn[:ntn],
        khata_enabled: defn[:khata_enabled] == true,
        loyalty_points: defn[:loyalty_points] || 0,
        marketing_opt_in_email: defn[:marketing_opt_in_email] == true,
        marketing_opt_in_sms: defn[:marketing_opt_in_sms] == true,
        marketing_opt_in_whatsapp: defn[:marketing_opt_in_whatsapp] == true,
        portal_enabled: defn[:portal] == true,
        business_id: business.id,
        owner_id: owner.id,
        profile_pic_key: portrait_for.({:customer, business.id, idx})
      }
    end)

  bulk_insert!.(
    Customer,
    attrs,
    extras: fn a -> %{profile_pic_key: a.profile_pic_key} end
  )

  :ok
end

seed_employees = fn owner, business, branches, portal_users ->
  existing = Hr.list_employees(business.id, owner.id)
  existing_by_code = Map.new(existing, &{&1.employee_code, &1})
  home_branch = hd(branches)

  portal_attrs =
    portal_users
    |> Enum.reject(fn {_role, user} -> is_nil(user) end)
    |> Enum.with_index()
    |> Enum.flat_map(fn {{role_key, user}, idx} ->
      code = "PORTAL-#{String.upcase(role_key)}"

      already =
        Map.get(existing_by_code, code) || Enum.find(existing, &(&1.user_id == user.id))

      if already do
        attrs =
          %{}
          |> then(fn a ->
            if is_nil(already.user_id), do: Map.put(a, :user_id, user.id), else: a
          end)
          |> then(fn a ->
            if already.name != user.name, do: Map.put(a, :name, user.name), else: a
          end)
          |> then(fn a ->
            if is_nil(already.profile_pic_key) or already.profile_pic_key == "",
              do: Map.put(a, :profile_pic_key, portrait_for.({:employee, already.id})),
              else: a
          end)

        if map_size(attrs) > 0 do
          _ = already |> change(attrs) |> Repo.update()
        end

        []
      else
        position =
          case role_key do
            "admin" -> "Administrator"
            "cashier" -> "Cashier"
            "employee" -> "Employee"
            _ -> "Staff"
          end

        [
          %{
            employee_code: code,
            name: user.name,
            position: position,
            join_date: Date.add(Date.utc_today(), -(30 + idx * 5)),
            basic_salary: "#{30_000 + idx * 5_000}",
            allowances: %{"transport" => "3000", "meal" => "2000"},
            phone: user.phone,
            status: "active",
            business_id: business.id,
            owner_id: owner.id,
            branch_id: home_branch.id,
            user_id: user.id,
            profile_pic_key: portrait_for.({:employee, {business.id, code}})
          }
        ]
      end
    end)

  linked_user_ids =
    existing
    |> Enum.filter(& &1.user_id)
    |> MapSet.new(& &1.user_id)

  generic_attrs =
    Enum.flat_map(Enum.with_index(branches, 1), fn {branch, bidx} ->
      Enum.flat_map(1..5, fn eidx ->
        code = "E#{String.slice(business.id, 0, 4)}-B#{bidx}-#{eidx}"
        gidx = (bidx - 1) * 5 + eidx

        case Map.get(existing_by_code, code) do
          %Employee{} = emp ->
            if emp.user_id && MapSet.member?(linked_user_ids, emp.user_id) do
              []
            else
              if is_nil(emp.profile_pic_key) or emp.profile_pic_key == "" do
                _ =
                  emp
                  |> change(%{profile_pic_key: portrait_for.({:employee, emp.id})})
                  |> Repo.update()
              end

              []
            end

          nil ->
            [
              %{
                employee_code: code,
                name: Enum.at(employee_names, rem(gidx, length(employee_names))),
                position: Enum.at(positions, rem(gidx, length(positions))),
                join_date: Date.add(Date.utc_today(), -(90 + gidx * 7)),
                basic_salary: "#{22_000 + gidx * 1_500}",
                allowances: %{"transport" => "2500", "meal" => "1500"},
                phone: "+92301#{1_000_000 + gidx * 117}",
                status: "active",
                business_id: business.id,
                owner_id: owner.id,
                branch_id: branch.id,
                user_id: nil,
                profile_pic_key: portrait_for.({:employee, {business.id, code}})
              }
            ]
        end
      end)
    end)

  _ =
    bulk_insert!.(
      Employee,
      portal_attrs ++ generic_attrs,
      extras: fn a -> %{profile_pic_key: a.profile_pic_key} end
    )

  Hr.list_employees(business.id, owner.id)
end

seed_portal_payroll = fn owner, business, employees ->
  portal = Enum.filter(employees, &(&1.user_id != nil))

  if portal == [] do
    :ok
  else
    today = Date.utc_today()

    period_start =
      Date.new!(today.year, today.month, 1)
      |> Date.add(-1)
      |> then(fn d -> Date.new!(d.year, d.month, 1) end)

    period_end = Date.new!(today.year, today.month, 1) |> Date.add(-1)

    existing =
      from(r in Kaarobar.Schemas.PayrollRun,
        where:
          r.business_id == ^business.id and r.period_start == ^period_start and
            r.period_end == ^period_end
      )
      |> Repo.one()

    run =
      case existing do
        nil ->
          case Hr.create_payroll_run(business.id, owner.id, period_start, period_end) do
            {:ok, r} -> r
            _ -> nil
          end

        r ->
          r
      end

    if run && run.status in ["Draft", "PendingApproval"] do
      _ = Hr.submit_payroll(run.id, owner.id)
      _ = Hr.approve_payroll(run.id, owner.id, owner.id)
    end

    :ok
  end
end

seed_attendance = fn owner, business, employees, branches ->
  target_emps = Enum.take(employees, 12)
  emp_ids = Enum.map(target_emps, & &1.id)

  existing_keys =
    if emp_ids == [] do
      MapSet.new()
    else
      from(a in AttendanceRecord,
        where: a.employee_id in ^emp_ids,
        select: {a.employee_id, a.date}
      )
      |> Repo.all()
      |> MapSet.new()
    end

  attrs =
    target_emps
    |> Enum.with_index()
    |> Enum.flat_map(fn {emp, idx} ->
      branch = Enum.find(branches, &(&1.id == emp.branch_id)) || hd(branches)

      Enum.flat_map(0..2, fn day_offset ->
        date = Date.add(Date.utc_today(), -(day_offset + 1))

        if MapSet.member?(existing_keys, {emp.id, date}) do
          []
        else
          cin =
            DateTime.new!(date, ~T[04:00:00], "Etc/UTC")
            |> DateTime.add(idx * 300, :second)
            |> DateTime.truncate(:second)

          cout = DateTime.add(cin, 8 * 3600 + rem(idx, 3) * 1800, :second)

          [
            %{
              employee_id: emp.id,
              branch_id: branch.id,
              owner_id: owner.id,
              business_id: business.id,
              date: date,
              clock_in: cin,
              clock_out: cout,
              source: "pos"
            }
          ]
        end
      end)
    end)

  bulk_insert!.(AttendanceRecord, attrs, [])
  :ok
end

seed_leave = fn owner, business, employees ->
  cases = [
    {0, "annual", "Pending", "Family event", 7, 8},
    {1, "sick", "Approved", "Fever", -5, -4},
    {2, "casual", "Rejected", "Personal errand", -10, -10}
  ]

  attrs =
    Enum.flat_map(cases, fn {idx, type, status, reason, start_off, end_off} ->
      emp = Enum.at(employees, idx)

      if is_nil(emp) do
        []
      else
        exists? =
          from(l in LeaveRequest,
            where: l.employee_id == ^emp.id and l.type == ^type and l.status == ^status
          )
          |> Repo.exists?()

        if exists? do
          []
        else
          [
            %{
              employee_id: emp.id,
              business_id: business.id,
              owner_id: owner.id,
              type: type,
              start_date: Date.add(Date.utc_today(), start_off),
              end_date: Date.add(Date.utc_today(), end_off),
              reason: reason,
              status: status
            }
          ]
        end
      end
    end)

  bulk_insert!.(LeaveRequest, attrs, [])
  :ok
end

seed_opening_journal = fn owner, business ->
  cash = Accounting.get_account_by_code(business.id, "1000")
  capital = Accounting.get_account_by_code(business.id, "3000")

  already =
    from(j in Kaarobar.Schemas.JournalEntry,
      where:
        j.business_id == ^business.id and j.source_type == "manual" and
          j.description == "Opening capital"
    )
    |> Repo.exists?()

  if cash && capital && not already do
    amount = Decimal.new("#{120_000 + rem(:erlang.phash2(business.id), 400_000)}")

    Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
      description: "Opening capital",
      date: Date.add(Date.utc_today(), -45),
      source_type: "manual",
      lines: [
        %{account_id: cash.id, debit: amount, credit: Decimal.new(0), memo: "Cash float"},
        %{account_id: capital.id, debit: Decimal.new(0), credit: amount, memo: "Owner capital"}
      ]
    })
  end
end

expected_sale_total = fn product, branch_id, qty ->
  price_row =
    Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: branch_id)

  unit = (price_row && price_row.price) || Decimal.new("100")
  line = Decimal.mult(unit, qty)
  tax_rate = product.tax_rate || Decimal.new("0.18")
  tax = Decimal.mult(line, tax_rate) |> Decimal.round(2)
  Decimal.add(line, tax) |> Decimal.round(2)
end

seed_branch_sales = fn owner, business, branch, products, cashier ->
  sale_count =
    from(s in Kaarobar.Schemas.Sale, where: s.branch_id == ^branch.id)
    |> Repo.aggregate(:count)

  if sale_count >= 12 or products == [] do
    :ok
  else
    till =
      case Pos.open_till_for_branch(branch.id) do
        nil ->
          case Pos.open_till(branch.id, owner.id, business.id, cashier.id, "5000") do
            {:ok, t} -> t
            _ -> nil
          end

        t ->
          t
      end

    Enum.each(1..12, fn i ->
      product = Enum.at(products, rem(i + :erlang.phash2(branch.id), length(products)))
      qty = Decimal.new(1 + rem(i, 3))
      inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)

      if inv && Decimal.compare(inv.quantity_on_hand, qty) in [:gt, :eq] do
        total = expected_sale_total.(product, branch.id, qty)
        method = Enum.at(["cash", "card", "wallet"], rem(i, 3))

        Pos.create_sale(branch.id, owner.id, business.id, cashier.id, %{
          client_txn_id: Ecto.UUID.generate(),
          till_id: till && till.id,
          items: [%{product_id: product.id, quantity: qty, discount: "0"}],
          payments: [%{method: method, amount: total}]
        })
      end
    end)
  end
end

# —— Allocate businesses across owners ——————————————————————————

{assignments, _} =
  Enum.map_reduce(owner_defs, 0, fn def, offset ->
    slice = Enum.slice(business_pool, offset, def.business_count)
    {{def, slice}, offset + def.business_count}
  end)

# —— Seed each owner ————————————————————————————————————————————

owner_summaries =
  Enum.map(assignments, fn {odef, biz_defs} ->
    IO.puts("Owner #{odef.email} (#{odef.plan}) — #{length(biz_defs)} businesses")

    owner = ensure_user.(odef.email, odef.name, odef.phone)
    {:ok, _} = Billing.set_plan(owner.id, odef.plan)

    # Per-owner staff (primary owner keeps classic emails)
    role_defs = staff_roles_for_plan.(odef.plan)

    staff =
      Enum.map(role_defs, fn {role, name, roles} ->
        email =
          if odef.staff_prefix == "" do
            "#{role}@kaarobar.local"
          else
            "#{role}#{odef.staff_prefix}@kaarobar.local"
          end

        user =
          ensure_user.(
            email,
            if(odef.staff_prefix == "", do: name, else: "#{name} #{odef.staff_prefix}"),
            "+92300#{1_000_000 + :erlang.phash2(email, 8_999_999)}"
          )

        {user, roles, role, email}
      end)

    cashier = Enum.find_value(staff, fn {u, roles, _, _} -> if "cashier" in roles, do: u end)
    admin_user = Enum.find_value(staff, fn {u, roles, _, _} -> if "admin" in roles, do: u end)

    employee_user =
      Enum.find_value(staff, fn {u, roles, _, _} -> if "employee" in roles, do: u end)

    portal_users =
      [
        {"admin", admin_user},
        {"cashier", cashier},
        {"employee", employee_user}
      ]
      |> Enum.reject(fn {_, u} -> is_nil(u) end)

    businesses =
      biz_defs
      |> Enum.with_index()
      |> Enum.map(fn {{name, industry, fbr}, idx} ->
        business =
          from(b in Kaarobar.Schemas.Business,
            where: b.owner_id == ^owner.id and b.name == ^name
          )
          |> Repo.one()

        business =
          case business do
            nil ->
              {:ok, b} =
                Tenancy.create_business(owner.id, %{
                  name: name,
                  industry: industry,
                  tax_jurisdiction: "PK",
                  fbr_tier1: fbr,
                  subscription_plan: odef.plan
                })

              b

            b ->
              b
          end

        # 2–5 branches per business, capped by plan limits
        plan_branch_cap =
          case odef.plan do
            "trial" -> 2
            "starter" -> 10
            "growth" -> 50
            _ -> 500
          end

        desired_branches =
          min(2 + rem(idx + :erlang.phash2(business.id), 4), plan_branch_cap)

        city = Enum.at(cities, rem(idx + :erlang.phash2(owner.id), length(cities)))
        existing = Tenancy.list_branches_for_business(business.id, owner, active_only: false)

        branches =
          if length(existing) >= desired_branches do
            Enum.take(existing, desired_branches)
          else
            needed = desired_branches - length(existing)

            new =
              Enum.reduce_while(0..(needed - 1), [], fn i, acc ->
                unless Billing.within_limits?(owner.id, :branch) do
                  {:halt, acc}
                else
                  suffix =
                    Enum.at(
                      branch_suffixes,
                      rem(length(existing) + i, length(branch_suffixes))
                    )

                  case Tenancy.create_branch(business.id, owner, %{
                         name: "#{city} #{suffix}",
                         timezone: "Asia/Karachi",
                         refund_auto_approve_limit: "5000",
                         discount_auto_approve_limit: "1500",
                         return_window_days: 14,
                         address: %{city: city, area: suffix}
                       }) do
                    {:ok, br} -> {:cont, acc ++ [br]}
                    _ -> {:halt, acc}
                  end
                end
              end)

            existing ++ new
          end

        if branches == [] do
          IO.puts("  ! #{business.name} — no branches (plan limit?)")
          %{business: business, branches: [], products: [], employees: []}
        else
          # Memberships:
          # - admin / cashier / employee → first branch of first business only
          #   (matches linked HR profile for ESS; avoids orphan tenant switches)
          # - managers / accountant / hr / inventory → business-wide on every business
          Enum.each(staff, fn {user, roles, _role, _email} ->
            portal_scoped? = Enum.any?(roles, &MapSet.member?(branch_scoped_roles, &1))

            cond do
              portal_scoped? and idx == 0 ->
                ensure_membership.(owner, business, user, roles, hd(branches).id)

              portal_scoped? ->
                :ok

              true ->
                ensure_membership.(owner, business, user, roles, nil)
            end
          end)

          catalog = catalog_for.(industry)
          products = seed_products.(owner, business, branches, catalog)
          seed_suppliers.(owner, business)
          seed_customers.(owner, business)

          # Link portal logins to HR profiles on the owner's first business only
          # (employees.user_id is globally unique).
          employees =
            if idx == 0 do
              emps = seed_employees.(owner, business, branches, portal_users)
              seed_portal_payroll.(owner, business, emps)
              emps
            else
              seed_employees.(owner, business, branches, [])
            end

          seed_attendance.(owner, business, employees, branches)
          seed_leave.(owner, business, employees)
          seed_opening_journal.(owner, business)

          # Sales on every branch for first 3 businesses of each owner
          if idx < 3 do
            Enum.each(branches, fn branch ->
              seed_branch_sales.(owner, business, branch, products, cashier || owner)
            end)
          end

          IO.puts(
            "  • #{business.name} [#{industry}] — #{length(branches)} branches, #{length(products)} products, #{length(employees)} employees"
          )

          %{
            business: business,
            branches: branches,
            products: products,
            employees: employees
          }
        end
      end)

    %{
      owner: owner,
      email: odef.email,
      plan: odef.plan,
      staff: staff,
      businesses: businesses
    }
  end)

# —— Keep portal staff on the business that owns their HR profile ——————

Enum.each(owner_summaries, fn %{staff: staff} ->
  Enum.each(staff, fn {user, roles, _role, _email} ->
    if Enum.any?(roles, &MapSet.member?(branch_scoped_roles, &1)) do
      case Repo.one(from(e in Kaarobar.Schemas.Employee, where: e.user_id == ^user.id)) do
        %{business_id: home_biz} ->
          {n, _} =
            from(m in Kaarobar.Schemas.Membership,
              where: m.user_id == ^user.id and m.business_id != ^home_biz
            )
            |> Repo.delete_all()

          if n > 0 do
            IO.puts("  cleaned #{n} extra membership(s) for #{user.email}")
          end

        _ ->
          :ok
      end
    end
  end)
end)

# —— Sample in-app notifications + default prefs ————————————————

alias Kaarobar.Notifications

demo_inbox_emails =
  MapSet.new([
    "owner@kaarobar.local",
    "admin@kaarobar.local",
    "cashier@kaarobar.local",
    "employee@kaarobar.local"
  ])

notification_attrs =
  Enum.flat_map(owner_summaries, fn %{owner: owner, staff: staff} ->
    targets =
      [owner | Enum.map(staff, fn {u, _roles, _role, _email} -> u end)]
      |> Enum.filter(fn u -> MapSet.member?(demo_inbox_emails, u.email) end)

    Enum.flat_map(targets, fn user ->
      Notifications.get_or_create_preferences(user.id)

      existing_types =
        from(n in Notification,
          where: n.user_id == ^user.id and n.channel == "in_app",
          select: n.type
        )
        |> Repo.all()
        |> MapSet.new()

      [
        {"leave_request", "Leave request pending", "A teammate submitted leave for review."},
        {"payroll.approved", "Payslip ready", "Your latest payslip has been approved."},
        {"billing.limit", "Plan usage", "You're approaching a plan limit on this workspace."}
      ]
      |> Enum.reject(fn {type, _, _} -> MapSet.member?(existing_types, type) end)
      |> Enum.map(fn {type, title, body} ->
        %{
          user_id: user.id,
          owner_id: owner.id,
          channel: "in_app",
          type: type,
          title: title,
          body: body,
          payload: %{},
          status: "sent",
          sent_at: seed_now
        }
      end)
    end)
  end)

_ = bulk_insert!.(Notification, notification_attrs, [])
IO.puts("Seeded sample in-app notifications for demo portal users")

# —— Deep demo data: CRM, AR/AP, PO, portal (primary owner) ————

seed_crm_and_finance = fn owner, business, branches, products ->
  customers =
    from(c in Customer, where: c.business_id == ^business.id, order_by: [asc: c.name])
    |> Repo.all()

  suppliers =
    from(s in Supplier, where: s.business_id == ^business.id, order_by: [asc: s.name])
    |> Repo.all()

  branch = List.first(branches)
  product = List.first(products)

  _ =
    business
    |> change(%{portal_self_register: true, portal_invite_from_sale: true})
    |> Repo.update()

  existing_tier_names =
    from(t in LoyaltyTier, where: t.business_id == ^business.id, select: t.name)
    |> Repo.all()
    |> MapSet.new()

  tier_defs = [
    %{name: "Bronze", min_points: 0, earn_rate: "1", redeem_rate: "1"},
    %{name: "Silver", min_points: 200, earn_rate: "1.25", redeem_rate: "1.1"},
    %{name: "Gold", min_points: 800, earn_rate: "1.5", redeem_rate: "1.25"}
  ]

  _ =
    bulk_insert!.(
      LoyaltyTier,
      tier_defs
      |> Enum.reject(fn t -> MapSet.member?(existing_tier_names, t.name) end)
      |> Enum.map(fn t ->
        Map.merge(t, %{business_id: business.id, owner_id: owner.id})
      end),
      []
    )

  tiers =
    from(t in LoyaltyTier, where: t.business_id == ^business.id)
    |> Repo.all()

  gold = Enum.find(tiers, &(&1.name == "Gold"))
  silver = Enum.find(tiers, &(&1.name == "Silver"))
  bronze = Enum.find(tiers, &(&1.name == "Bronze"))

  Enum.each(customers, fn c ->
    tier =
      cond do
        (c.loyalty_points || 0) >= 800 -> gold
        (c.loyalty_points || 0) >= 200 -> silver
        true -> bronze
      end

    if tier && c.loyalty_tier_id != tier.id do
      _ = c |> Customer.changeset(%{loyalty_tier_id: tier.id}) |> Repo.update()
    end
  end)

  segment =
    case from(s in CampaignSegment,
           where: s.business_id == ^business.id and s.name == "Khata regulars"
         )
         |> Repo.one() do
      nil ->
        [s] =
          bulk_insert!.(
            CampaignSegment,
            [
              %{
                name: "Khata regulars",
                filters: %{"khata_enabled" => true, "min_points" => 50},
                business_id: business.id,
                owner_id: owner.id
              }
            ],
            []
          )

        s

      s ->
        s
    end

  existing_coupon_codes =
    from(c in Coupon, where: c.business_id == ^business.id, select: c.code)
    |> Repo.all()
    |> MapSet.new()

  coupon_attrs =
    [
      %{
        code: "WELCOME10",
        discount_type: "percent",
        discount_value: "10",
        min_cart: "500",
        usage_limit: 100,
        stackable: false,
        active: true,
        valid_from: DateTime.add(seed_now, -7 * 86_400, :second),
        valid_to: DateTime.add(seed_now, 90 * 86_400, :second),
        business_id: business.id,
        owner_id: owner.id
      },
      %{
        code: "FLAT100",
        discount_type: "fixed",
        discount_value: "100",
        min_cart: "1000",
        usage_limit: 50,
        stackable: true,
        active: true,
        business_id: business.id,
        owner_id: owner.id
      }
    ]
    |> Enum.reject(fn c -> MapSet.member?(existing_coupon_codes, c.code) end)

  inserted_coupons = bulk_insert!.(Coupon, coupon_attrs, [])

  coupon =
    Enum.find(inserted_coupons, &(&1.code == "WELCOME10")) ||
      from(c in Coupon, where: c.business_id == ^business.id and c.code == "WELCOME10")
      |> Repo.one()

  existing_campaign_names =
    from(c in CrmCampaign, where: c.business_id == ^business.id, select: c.name)
    |> Repo.all()
    |> MapSet.new()

  campaign_attrs =
    [
      %{
        name: "Ramadan loyalty push",
        title: "Earn double points this week",
        message: "Visit any branch and earn 2× loyalty points on grocery baskets over Rs 1,000.",
        audience: "segment",
        segment_id: segment && segment.id,
        channel: "email",
        coupon_id: coupon && coupon.id,
        business_id: business.id,
        owner_id: owner.id,
        created_by_id: owner.id
      },
      %{
        name: "SMS flash sale",
        title: "Tonight only",
        message: "Use code FLAT100 at checkout for Rs 100 off carts over Rs 1,000.",
        audience: "khata",
        channel: "sms",
        business_id: business.id,
        owner_id: owner.id,
        created_by_id: owner.id
      }
    ]
    |> Enum.reject(fn c -> MapSet.member?(existing_campaign_names, c.name) end)

  _ = bulk_insert!.(CrmCampaign, campaign_attrs, [])

  # AR / AP / PO keep context helpers (journals + stock side-effects)
  khata_customers = Enum.filter(customers, & &1.khata_enabled)

  Enum.each(Enum.with_index(Enum.take(khata_customers, 8)), fn {cust, i} ->
    inv_no = "AR-DEMO-#{String.slice(business.id, 0, 4)}-#{i + 1}"

    unless from(a in Kaarobar.Schemas.ArInvoice,
             where: a.business_id == ^business.id and a.invoice_number == ^inv_no
           )
           |> Repo.exists?() do
      subtotal = Decimal.new("#{5_000 + i * 2_500}")
      tax = Decimal.mult(subtotal, Decimal.new("0.18")) |> Decimal.round(2)

      case Accounting.create_ar_invoice(business.id, owner.id, owner.id, %{
             customer_id: cust.id,
             branch_id: branch && branch.id,
             invoice_number: inv_no,
             invoice_date: Date.add(Date.utc_today(), -(20 + i * 5)),
             due_date: Date.add(Date.utc_today(), -(5 - i * 10)),
             subtotal: subtotal,
             tax_amount: tax,
             notes: "Demo credit invoice for #{cust.name}"
           }) do
        {:ok, inv} when rem(i, 3) == 0 ->
          half = Decimal.div(inv.balance_due, Decimal.new(2)) |> Decimal.round(2)

          _ =
            Accounting.record_ar_payment(inv.id, owner.id, owner.id, %{
              amount: half,
              method: "cash"
            })

        _ ->
          :ok
      end
    end
  end)

  Enum.each(Enum.with_index(Enum.take(suppliers, 6)), fn {supplier, i} ->
    bill_no = "AP-DEMO-#{String.slice(business.id, 0, 4)}-#{i + 1}"

    unless from(b in Kaarobar.Schemas.ApBill,
             where: b.business_id == ^business.id and b.bill_number == ^bill_no
           )
           |> Repo.exists?() do
      total = Decimal.new("#{12_000 + i * 4_000}")

      case Accounting.create_ap_bill(business.id, owner.id, owner.id, %{
             supplier_id: supplier.id,
             branch_id: branch && branch.id,
             bill_number: bill_no,
             bill_date: Date.add(Date.utc_today(), -(15 + i * 3)),
             due_date: Date.add(Date.utc_today(), 10 - i * 5),
             total_amount: total,
             notes: "Stock replenishment — #{supplier.name}"
           }) do
        {:ok, bill} when rem(i, 2) == 1 ->
          _ =
            Accounting.record_ap_payment(bill.id, owner.id, owner.id, %{
              amount: bill.balance_due,
              method: "bank_transfer"
            })

        _ ->
          :ok
      end
    end
  end)

  if branch && product && suppliers != [] do
    supplier = hd(suppliers)

    po_exists? =
      from(p in Kaarobar.Schemas.PurchaseOrder,
        where:
          p.business_id == ^business.id and p.branch_id == ^branch.id and
            p.supplier_id == ^supplier.id,
        limit: 1
      )
      |> Repo.exists?()

    unless po_exists? do
      Inventory.create_purchase_order(business.id, branch.id, owner.id, %{
        supplier_id: supplier.id,
        status: "ordered",
        notes: "Weekly top-up",
        expected_delivery_date: Date.add(Date.utc_today(), 3),
        items: [%{product_id: product.id, quantity: "24", unit_cost: "150"}]
      })
    end
  end

  if branch && product && length(suppliers) > 1 do
    supplier = Enum.at(suppliers, 1)

    unless from(p in Kaarobar.Schemas.PurchaseOrder,
             where:
               p.business_id == ^business.id and p.supplier_id == ^supplier.id and
                 p.status == "draft",
             limit: 1
           )
           |> Repo.exists?() do
      Inventory.create_purchase_order(business.id, branch.id, owner.id, %{
        supplier_id: supplier.id,
        status: "draft",
        notes: "Pending manager approval",
        items: [%{product_id: product.id, quantity: "10", unit_cost: "140"}]
      })
    end
  end

  portal_account_attrs =
    customers
    |> Enum.filter(fn c -> c.portal_enabled and is_binary(c.email) and c.email != "" end)
    |> Enum.reject(fn c ->
      from(a in CustomerAccount,
        where: a.business_id == ^business.id and a.email == ^String.downcase(c.email)
      )
      |> Repo.exists?()
    end)
    |> Enum.map(fn c ->
      %{
        email: String.downcase(c.email),
        customer_id: c.id,
        owner_id: owner.id,
        business_id: business.id,
        status: "active"
      }
    end)

  _ =
    bulk_insert!.(
      CustomerAccount,
      portal_account_attrs,
      changeset: fn data, attrs ->
        data
        |> cast(attrs, [
          :email,
          :customer_id,
          :owner_id,
          :business_id,
          :status,
          :email_verified
        ])
        |> validate_required([:email, :customer_id, :owner_id, :business_id])
        |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/)
        |> update_change(:email, &String.downcase/1)
      end,
      extras: fn _ ->
        # All seeded portal customers use portal_password from customer_defs (Password@123)
        %{
          password_hash: demo_password_hash,
          email_verified: true,
          email_verify_token_hash: nil
        }
      end
    )

  :ok
end

Enum.each(owner_summaries, fn %{owner: owner, email: email, businesses: businesses} ->
  if email == "owner@kaarobar.local" do
    businesses
    |> Enum.take(3)
    |> Enum.each(fn
      %{business: business, branches: branches, products: products} when branches != [] ->
        seed_crm_and_finance.(owner, business, branches, products)
        IO.puts("  + enriched #{business.name} (CRM / AR-AP / PO / portal)")

      _ ->
        :ok
    end)
  end
end)

# —— Summary ————————————————————————————————————————————————————

total_owners = length(owner_summaries)

total_businesses =
  Enum.reduce(owner_summaries, 0, fn s, acc -> acc + length(s.businesses) end)

total_branches =
  Enum.reduce(owner_summaries, 0, fn s, acc ->
    acc + Enum.reduce(s.businesses, 0, fn b, a -> a + length(b.branches) end)
  end)

total_employees =
  from(e in Kaarobar.Schemas.Employee) |> Repo.aggregate(:count)

total_products =
  from(p in Kaarobar.Schemas.Product) |> Repo.aggregate(:count)

total_sales =
  from(s in Kaarobar.Schemas.Sale) |> Repo.aggregate(:count)

total_attendance =
  from(a in Kaarobar.Schemas.AttendanceRecord) |> Repo.aggregate(:count)

total_customers =
  from(c in Customer) |> Repo.aggregate(:count)

total_images =
  from(i in ProductImage) |> Repo.aggregate(:count)

total_ar =
  from(a in Kaarobar.Schemas.ArInvoice) |> Repo.aggregate(:count)

total_ap =
  from(b in Kaarobar.Schemas.ApBill) |> Repo.aggregate(:count)

total_coupons =
  from(c in Kaarobar.Schemas.Coupon) |> Repo.aggregate(:count)

total_portal =
  from(a in Kaarobar.Schemas.CustomerAccount) |> Repo.aggregate(:count)

staff_logins =
  owner_summaries
  |> Enum.flat_map(fn s ->
    Enum.map(s.staff, fn {_u, _roles, _role, email} -> email end)
  end)
  |> Enum.join("\n  ")

owner_logins =
  owner_summaries
  |> Enum.map(fn s ->
    "#{s.email} (#{s.plan}, #{length(s.businesses)} businesses)"
  end)
  |> Enum.join("\n  ")

portal_login_lines =
  owner_summaries
  |> Enum.filter(fn s -> s.email == "owner@kaarobar.local" end)
  |> Enum.flat_map(fn s -> Enum.take(s.businesses, 3) end)
  |> Enum.flat_map(fn %{business: business} ->
    customer_defs
    |> Enum.filter(&(&1[:portal] == true && is_binary(&1[:email])))
    |> Enum.map(fn defn ->
      pwd = defn[:portal_password] || "Password@123"
      "#{defn.email}  /  #{pwd}  (business_id: #{business.id} · #{business.name})"
    end)
  end)
  |> Enum.join("\n  ")

IO.puts("""

Seed complete. Password for all demo users: Password@123

Owners
  #{owner_logins}

Staff portal logins (primary owner — also mirrored per-owner with suffixes 2/3/4)
  admin@kaarobar.local       → Admin (POS, inventory, HR-ish ops, Staff tools)
  employee@kaarobar.local    → Employee (POS, inventory, Staff tools / ESS)
  cashier@kaarobar.local     → Cashier (POS, Staff tools / ESS)
  manager@kaarobar.local     → Branch manager
  accountant@kaarobar.local  → Accountant
  hr@kaarobar.local          → HR manager
  inventory@kaarobar.local   → Inventory manager

  #{staff_logins}

ESS: admin / cashier / employee are linked to HR employee profiles on each owner's first business
     (clock-in, leave, payslips). Owners do not get Staff tools.

Customer portal (/portal/login) — use Business ID + email + password
  #{portal_login_lines}

POS coupons on enriched businesses: WELCOME10 (10%), FLAT100 (Rs 100)

Counts
  Owners:       #{total_owners}
  Businesses:   #{total_businesses}
  Branches:     #{total_branches}
  Products:     #{total_products}
  Product imgs: #{total_images}
  Employees:    #{total_employees}
  Customers:    #{total_customers}
  Portal accts: #{total_portal}
  Coupons:      #{total_coupons}
  AR invoices:  #{total_ar}
  AP bills:     #{total_ap}
  Sales:        #{total_sales}
  Attendance:   #{total_attendance}
""")
