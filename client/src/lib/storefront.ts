export const departments = [
  {
    name: "Electronics",
    slug: "electronics",
    image: "headphones",
    caption: "Plug into something good",
    color: "yellow",
  },
  {
    name: "Fashion",
    slug: "fashion",
    image: "fashion",
    caption: "Find your everyday style",
    color: "pink",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    image: "home",
    caption: "Make yourself at home",
    color: "sand",
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    image: "beauty",
    caption: "A little care goes a long way",
    color: "lilac",
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-outdoors",
    image: "sports",
    caption: "For your next adventure",
    color: "green",
  },
  {
    name: "Books",
    slug: "books",
    image: "books",
    caption: "Turn over a new page",
    color: "blue",
  },
] as const;

export const shopImage = (name: string) =>
  `${import.meta.env.BASE_URL}images/${name}.jpg`;

export function accountName(email: string) {
  const name = email.split("@")[0].replace(/[._-]+/g, " ");
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
