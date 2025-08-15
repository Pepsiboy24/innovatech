const template = document.querySelector("[data-template]");
const holder = document.querySelector("[data-achivementHolder]");

const achivements = [
  {
    position: "5th",
    icon: "fa-solid fa-medal",
    type: "rank",
    description: "In class",
  },
  {
    position: 2450,
    icon: "fa-solid fa-trophy",
    type: "points",
    description: "Total Points",
  },
  {
    position: 12,
    icon: "fa-solid fa-certificate",
    type: "Badges",
    description: "Earned",
  },
  {
    position: 8,
    icon: "fa-solid fa-star",
    type: "Achivevements",
    description: "Unlocked",
  },
];

achivements.forEach((elem) => {
  const card = template.content.cloneNode(true).children[0];
  const position = card.querySelector("[data-position]");
  const icon = card.querySelector("[data-icon]");
  const type = card.querySelector("[data-type]");
  const description = card.querySelector("[data-desc]");

  position.textContent = elem.position;
  icon.className = elem.icon;
  type.textContent = elem.type;
  description.textContent = elem.description;

  holder.append(card);
});

const leaderboardTemplate = document.querySelector("[data-leaderBoard-template]")
const classLeaderboardTable = document.querySelector("[data-class-leaderboard]")
const schoolLeaderboardTable = document.querySelector(
  "[data-school-leaderboard]"
);
const leaderboard = [
  {
    postion: 1,
    name: "John Doe",
    img: "fa-solid fa-user",
    points: 3240
  },
  {
    postion: 2,
    name: "Jane Doe",
    img: "fa-solid fa-user",
    points: 3220
  },
]

leaderboard.forEach(elem => {
  const card = leaderboardTemplate.content.cloneNode(true).children[0];
  const name = card.querySelector("[data-userName]")
  const imgs = card.querySelector("[data-img]")
  const points = card.querySelector("[data-points]")
  const position = card.querySelector("[data-postion]")
  position.textContent = elem.postion
  name.textContent = elem.name;
  points.textContent = elem.points
  imgs.className = elem.img
  console.log(card)
  // console.log(leaderboardTable)

  classLeaderboardTable.append(card)
  schoolLeaderboardTable.append(card)
})
