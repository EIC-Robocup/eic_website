-- First content for the EIC Chula website, taken from the designs.
--
-- Load it with `pnpm db:seed` (scripts/seed.ts) or `psql -f supabase/seed.sql`.
-- The Supabase CLI also runs this file after `supabase db reset`.
--
-- Safe to run more than once: every row has a fixed id and every insert is
-- `on conflict do nothing`, so rows that already exist (by id or by slug) are
-- left as they are. Editors change the content in the admin panel afterwards.
--
-- Fixed ids: e1c000TT-0000-4000-8000-0000000000NN, TT = table, NN = row.
--   01 teams, 02 people, 03 projects, 04 posts, 05 publications,
--   06 achievements, 07 archive_photos
--
-- Not seeded: sponsors and editors (none yet), site_sections (defaults live in
-- src/lib/content/sections.ts), media, messages, activity.

begin;

-- ---------------------------------------------------------------------------
-- Teams, in the order of the People page
-- ---------------------------------------------------------------------------
insert into teams (id, slug, name, sort_order) values
	('e1c00001-0000-4000-8000-000000000001', 'leadership', 'Leadership', 1),
	('e1c00001-0000-4000-8000-000000000002', 'navigation', 'Navigation', 2),
	('e1c00001-0000-4000-8000-000000000003', 'ai', 'AI', 3),
	('e1c00001-0000-4000-8000-000000000004', 'mechanical-design', 'Mechanical Design', 4),
	('e1c00001-0000-4000-8000-000000000005', 'integration', 'Integration', 5),
	('e1c00001-0000-4000-8000-000000000006', 'operations-support', 'Operations & Support', 6)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- People. role NULL shows as "<Team> team". Leads (an explicit role in a team)
-- get is_lead. Leadership and advisors are featured on the home page.
-- ---------------------------------------------------------------------------
insert into people (id, name, role, kind, team_id, is_lead, featured, photo_url, sort_order) values
	-- Advisors (no team)
	('e1c00002-0000-4000-8000-000000000001', 'Assoc. Prof. Ronnapee Chaichaowarat, Ph.D.', 'Advisor', 'advisor', null, false, true, '/images/people/ronnapee-chaichaowarat.jpg', 1),
	('e1c00002-0000-4000-8000-000000000002', 'Asst. Prof. Ekapol Chuangsuwanich', 'Advisor', 'advisor', null, false, true, null, 2),
	('e1c00002-0000-4000-8000-000000000003', 'Witthawin Sripheanpol', 'Advisor', 'advisor', null, false, true, null, 3),

	-- Leadership
	('e1c00002-0000-4000-8000-000000000004', 'Taratorn Assawadejmetakul', 'Team Leader & contact', 'member', (select id from teams where slug = 'leadership'), true, true, '/images/people/taratorn-assawadejmetakul.webp', 1),
	('e1c00002-0000-4000-8000-000000000005', 'Arunkamon Khaipho', 'Vice Team Leader', 'member', (select id from teams where slug = 'leadership'), true, true, null, 2),
	('e1c00002-0000-4000-8000-000000000006', 'Tee Hemjinda', 'Project Manager', 'member', (select id from teams where slug = 'leadership'), true, true, null, 3),

	-- Navigation
	('e1c00002-0000-4000-8000-000000000007', 'Tanapon Jantarat', null, 'member', (select id from teams where slug = 'navigation'), false, false, null, 1),
	('e1c00002-0000-4000-8000-000000000008', 'Khemin Pinitkiatsakul', null, 'member', (select id from teams where slug = 'navigation'), false, false, null, 2),
	('e1c00002-0000-4000-8000-000000000009', 'Thanunnop Chukiattakul', null, 'member', (select id from teams where slug = 'navigation'), false, false, null, 3),
	('e1c00002-0000-4000-8000-000000000010', 'Nitis Kanjananaravadee', null, 'member', (select id from teams where slug = 'navigation'), false, false, null, 4),
	('e1c00002-0000-4000-8000-000000000011', 'Punyathorn Chenwithisuk', null, 'member', (select id from teams where slug = 'navigation'), false, false, null, 5),

	-- AI
	('e1c00002-0000-4000-8000-000000000012', 'Sorrawit Poomseetong', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 1),
	('e1c00002-0000-4000-8000-000000000013', 'Pimnapat Koovuthyakorn', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 2),
	('e1c00002-0000-4000-8000-000000000014', 'Pattaradanai Akkharat', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 3),
	('e1c00002-0000-4000-8000-000000000015', 'Natcha Ngaoprasertwong', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 4),
	('e1c00002-0000-4000-8000-000000000016', 'Tanakit Kaewhawong', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 5),
	('e1c00002-0000-4000-8000-000000000017', 'Naphat Sornwichai', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 6),
	('e1c00002-0000-4000-8000-000000000018', 'Settapun Lao-aree', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 7),
	('e1c00002-0000-4000-8000-000000000019', 'Nattawat Treerattanaphan', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 8),
	('e1c00002-0000-4000-8000-000000000020', 'Suphachat Sriharan', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 9),
	('e1c00002-0000-4000-8000-000000000021', 'Phatcharapon Inpor', null, 'member', (select id from teams where slug = 'ai'), false, false, null, 10),

	-- Mechanical Design
	('e1c00002-0000-4000-8000-000000000022', 'Supphakorn Akkapoo', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 1),
	('e1c00002-0000-4000-8000-000000000023', 'Patwee Wasunantharat', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 2),
	('e1c00002-0000-4000-8000-000000000024', 'Sippapas Techatipakorn', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 3),
	('e1c00002-0000-4000-8000-000000000025', 'Phakhin Kevin Chan', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 4),
	('e1c00002-0000-4000-8000-000000000026', 'Pasin Jindadumrongwech', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 5),
	('e1c00002-0000-4000-8000-000000000027', 'Nonthapat Chanama', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 6),
	('e1c00002-0000-4000-8000-000000000028', 'Chayut Warasin', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 7),
	('e1c00002-0000-4000-8000-000000000029', 'Roryon Wannapraserd', null, 'member', (select id from teams where slug = 'mechanical-design'), false, false, null, 8),

	-- Integration
	('e1c00002-0000-4000-8000-000000000030', 'Sutthikan Panla', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 1),
	('e1c00002-0000-4000-8000-000000000031', 'Natapol Chusang', null, 'member', (select id from teams where slug = 'integration'), false, false, '/images/people/natapol-chusang.webp', 2),
	('e1c00002-0000-4000-8000-000000000032', 'Tanawat Buttree', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 3),
	('e1c00002-0000-4000-8000-000000000033', 'Yukoldech Wiwatchaikit', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 4),
	('e1c00002-0000-4000-8000-000000000034', 'Thanakrit Aphonmaeklong', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 5),
	('e1c00002-0000-4000-8000-000000000035', 'Sophanut Chaiyachid', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 6),
	('e1c00002-0000-4000-8000-000000000036', 'Thawanrat Olanrik Suphak', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 7),
	('e1c00002-0000-4000-8000-000000000037', 'Peektiphon Panhun', null, 'member', (select id from teams where slug = 'integration'), false, false, null, 8),

	-- Operations & Support
	('e1c00002-0000-4000-8000-000000000038', 'Jakrin Pattnirun', 'Finance', 'member', (select id from teams where slug = 'operations-support'), true, false, null, 1),
	('e1c00002-0000-4000-8000-000000000039', 'Mekkhala Wunbamrung', 'Sponsorship', 'member', (select id from teams where slug = 'operations-support'), true, false, '/images/people/mekkhala-wunbamrung.webp', 2),
	('e1c00002-0000-4000-8000-000000000040', 'Nelinya Thanasittisupharat', 'Sponsorship', 'member', (select id from teams where slug = 'operations-support'), true, false, null, 3),
	('e1c00002-0000-4000-8000-000000000041', 'Rinrada Surapolchai', 'Sponsorship', 'member', (select id from teams where slug = 'operations-support'), true, false, null, 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Projects, in the order of the Projects page
-- ---------------------------------------------------------------------------
insert into projects (
	id, slug, title, category, year, status, tagline, summary,
	event, place, result, team_size,
	highlight_value, highlight_label, highlight_note,
	cover_url, cover_alt, cover_caption,
	tags, systems, parts, software, gallery,
	link_url, repo_url, paper_url,
	published, featured, show_gallery, sort_order
) values (
	'e1c00003-0000-4000-8000-000000000001', 'walkie-4', 'Walkie 4', 'robot', 2026, 'ongoing',
	'Listens. Navigates. Grasps.',
	'Two 7 DOF arms, 3D lidar SLAM and a four wheel omni base. 6th of 24 teams at RoboCup@Home 2026 in Incheon.',
	'RoboCup@Home 2026', 'Incheon, Korea', '6th of 24 teams', 41,
	'6th', 'RoboCup@Home 2026 · Incheon', 'of 24 teams!',
	null, 'Walkie 4, front view', 'Walkie 4, ready for Incheon',
	array['ROS 2', 'Nav2', 'MoveIt 2', 'VLA'],
	$json$[
		{ "title": "VLA and voice AI", "description": "Hears a request, sees the room, acts." },
		{ "title": "7 DOF arms", "description": "Carbon fiber, AK series actuators." },
		{ "title": "Semantic navigation", "description": "3D lidar SLAM that knows the kitchen." },
		{ "title": "Holonomic base", "description": "Four Ø152 omni wheels, any direction." }
	]$json$::jsonb,
	$json$[
		{ "qty": "4", "part": "Omni wheel Ø152", "note": "Direct drive" },
		{ "qty": "2", "part": "7 DOF arm", "note": "Parallel gripper" },
		{ "qty": "1", "part": "Lift", "note": "Torso travel" },
		{ "qty": "1", "part": "3D lidar", "note": "SLAM, mapping" },
		{ "qty": "2", "part": "2D lidar", "note": "Obstacles" },
		{ "qty": "1", "part": "RGB-D camera", "note": "Perception" },
		{ "qty": "1", "part": "Mic and speaker", "note": "Voice" }
	]$json$::jsonb,
	array['ROS 2 Jazzy', 'Ubuntu 24.04', 'Nav2', 'MoveIt 2'],
	$json$[
		{ "url": "", "alt": "Walkie 4 seen from the front", "caption": "Front view" },
		{ "url": "", "alt": "The map Walkie 4 builds as it navigates", "caption": "Navigation map" },
		{ "url": "", "alt": "The view from Walkie 4's camera", "caption": "Robot POV" },
		{ "url": "", "alt": "Walkie 4's gripper closing on an object", "caption": "Precision grasp" },
		{ "url": "", "alt": "Walkie 4's parts laid out on a table", "caption": "Parts laid out" }
	]$json$::jsonb,
	null, 'https://github.com/robocup-eic', null,
	true, true, true, 0
), (
	'e1c00003-0000-4000-8000-000000000002', 'walkie-agent-stack', 'Walkie agent stack', 'software', 2026, 'ongoing',
	null,
	'The agent software behind Walkie, written in Python with LangGraph on ROS 2.',
	null, null, null, null,
	null, null, null,
	null, null, null,
	array['Python', 'LangGraph', 'ROS 2'],
	'[]'::jsonb, '[]'::jsonb, '{}'::text[], '[]'::jsonb,
	null, null, null,
	true, false, true, 1
), (
	'e1c00003-0000-4000-8000-000000000003', 'robocup-smach', 'RoboCup smach', 'software', null, 'active',
	null,
	'Our open source SMACH state machines for RoboCup robots, in Python for ROS.',
	null, null, null, null,
	null, null, null,
	null, null, null,
	array['Python', 'SMACH', 'ROS'],
	'[]'::jsonb, '[]'::jsonb, '{}'::text[], '[]'::jsonb,
	'https://github.com/robocup-eic/smach', 'https://github.com/robocup-eic/smach', null,
	true, false, true, 2
), (
	'e1c00003-0000-4000-8000-000000000004', 'walkie-2', 'Walkie 2', 'robot', 2023, 'archived',
	null,
	'Our 2023 robot. 14th in the RoboCup@Home Open League in Bordeaux.',
	'RoboCup@Home 2023', 'Bordeaux', '14th · RoboCup@Home Open League', null,
	'14th', 'RoboCup@Home 2023 · Bordeaux', null,
	'/images/archive/walkie2-crew.webp', 'Team members beside Walkie 2 in a competition arena', 'Walkie 2 and crew',
	array['RoboCup@Home', 'Open League'],
	'[]'::jsonb, '[]'::jsonb, '{}'::text[],
	$json$[
		{ "url": "/images/archive/walkie2-table.webp", "alt": "A robot arm working over a white table", "caption": "Walkie 2 at work" },
		{ "url": "/images/archive/walkie2-arm.webp", "alt": "A robot arm lining up a grasp on a water bottle on a white table", "caption": "Walkie 2 lining up a bottle" }
	]$json$::jsonb,
	null, null, '/papers/eic-tdp-2023.pdf',
	true, false, true, 3
), (
	'e1c00003-0000-4000-8000-000000000005', 'walkie-1', 'Walkie 1', 'robot', 2022, 'archived',
	null,
	'The first Walkie. 2nd at RoboCup@Home 2022 in Bangkok.',
	'RoboCup@Home 2022', 'Bangkok', '2nd', null,
	'2nd', 'RoboCup@Home 2022 · Bangkok', null,
	null, null, null,
	array['RoboCup@Home', '2nd place'],
	'[]'::jsonb, '[]'::jsonb, '{}'::text[], '[]'::jsonb,
	null, null, null,
	true, false, true, 4
), (
	'e1c00003-0000-4000-8000-000000000006', 'soccer-and-rescue-robots', 'Soccer and rescue robots', 'robot', 2008, 'archived',
	null,
	'Our RoboCup Soccer and RoboCup Rescue robots, 2006 to 2008. 1st in both leagues in 2008.',
	'RoboCup Soccer and RoboCup Rescue', null, '1st · RoboCup Soccer and RoboCup Rescue 2008', null,
	'1st', 'RoboCup 2008 · Soccer and Rescue', null,
	'/images/archive/robocup-2008.jpg', 'The EIC team with their soccer robots at RoboCup 2008', 'RoboCup 2008',
	array['Soccer', 'Rescue'],
	'[]'::jsonb, '[]'::jsonb, '{}'::text[], '[]'::jsonb,
	'/about#achievements', null, null,
	true, false, true, 5
)
on conflict do nothing;

-- The soccer and rescue robots competed from 2006 to 2008.
update projects set year = 2006, year_end = 2008
where id = 'e1c00003-0000-4000-8000-000000000006' and year_end is null;

-- ---------------------------------------------------------------------------
-- Posts. Published at 09:00 Bangkok time on the designed dates; two drafts.
-- ---------------------------------------------------------------------------
insert into posts (
	id, slug, title, excerpt, body, category, author_name, status, published_at,
	cover_url, cover_alt, cover_caption, tags, project_id, featured, created_at, updated_at
) values (
	'e1c00004-0000-4000-8000-000000000001', 'your-first-semester-at-eic', 'Your first semester at EIC',
	'Pick a team, then ship real work onto a real robot.',
	$md$EIC Chula is the Engineering Innovator Club of Chulalongkorn University. We build Walkie, our robot for RoboCup@Home, and we have competed since 2006.

Your first step is to pick a team: Navigation, AI, Mechanical Design, Integration, or Operations & Support. Then you ship real work onto a real robot.

To join, tell us about you through the form on the [About page](/about#contact), or email us at chula.intania.eic@gmail.com. The lab is in Engineering Building 1. Our robot code is open source on [GitHub](https://github.com/robocup-eic), so you can read it before your first day.$md$,
	'club-life', 'EIC Chula', 'published', '2026-11-20 09:00:00+07',
	null, null, null, array['Joining', 'Teams'], null, false,
	'2026-11-20 09:00:00+07', '2026-11-20 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000002', 'meet-the-integration-team', 'Meet the Integration team',
	'Eight people, one of the five teams behind Walkie 4.',
	$md$Integration is one of the five teams that build Walkie 4, next to Navigation, AI, Mechanical Design, and Operations & Support. It has eight people.

They are Sutthikan Panla, Natapol Chusang, Tanawat Buttree, Yukoldech Wiwatchaikit, Thanakrit Aphonmaeklong, Sophanut Chaiyachid, Thawanrat Olanrik Suphak and Peektiphon Panhun.

Meet everyone else on the [People page](/people).$md$,
	'club-life', 'EIC Chula', 'published', '2026-10-24 09:00:00+07',
	null, null, null, array['Teams', 'Integration'], null, false,
	'2026-10-24 09:00:00+07', '2026-10-24 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000003', 'how-walkie-picks-up-a-can', 'How Walkie picks up a can',
	'From one RGB-D frame to a grasp, explained without the jargon.',
	$md$Ask Walkie for a drink and a lot happens before the gripper closes. It has to find the can, work out its shape in 3D, pick a way to hold it, and move an arm without hitting anything.

## Five stages, one grasp

1. **See**: an RGB-D frame of the scene
2. **Find**: segment the named object
3. **Shape**: pixels become a point cloud
4. **Choose**: score candidate grasps
5. **Move**: plan a collision free path

## Why segmentation comes first

A box drawn around a can also holds the shelf behind it. Plan a grasp on that and the arm reaches for the shelf. Segmenting first leaves only the can's pixels, so the point cloud is the can and nothing else.

![A robot arm lining up a grasp on a water bottle on a white table](/images/archive/walkie2-arm.webp "An earlier grasp: Walkie 2 lining up a bottle.")

## What we are improving next

Today the stages run one after another. Next, grasping runs in a closed loop so the robot keeps correcting as it moves, and the base moves as part of the arm's plan.$md$,
	'engineering', 'AI Team', 'published', '2026-09-14 09:00:00+07',
	null, 'Gripper closing on a can', 'Walkie 4''s parallel gripper',
	array['Manipulation', 'Perception', 'MoveIt 2', 'Walkie 4'],
	(select id from projects where slug = 'walkie-4'), false,
	'2026-09-14 09:00:00+07', '2026-09-14 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000004', 'from-voice-command-to-robot-action', 'From voice command to robot action',
	'How Walkie 4 hears a request, sees the room and acts.',
	$md$Walkie 4 hears a request, sees the room and acts. Two systems make that work: voice AI, and a vision language action (VLA) model.

A microphone and speaker carry the conversation. An RGB-D camera gives the robot its view of the room. The Walkie agent stack, written in Python with LangGraph on ROS 2, ties them to the robot.

The AI team, ten people, builds this software. For one action in detail, read [How Walkie picks up a can](/blog/how-walkie-picks-up-a-can).$md$,
	'engineering', 'AI Team', 'published', '2026-08-22 09:00:00+07',
	null, null, null, array['VLA', 'Voice', 'LangGraph', 'Walkie 4'],
	(select id from projects where slug = 'walkie-4'), false,
	'2026-08-22 09:00:00+07', '2026-08-22 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000005', 'six-of-twenty-four-our-week-at-robocup-home-2026', 'Six of twenty four: our week at RoboCup@Home 2026',
	'Walkie 4 finished 6th of 24 teams at RoboCup@Home 2026 in Incheon.',
	$md$Walkie 4 finished 6th of 24 teams at RoboCup@Home 2026 in Incheon, Korea. In 2023, Walkie 2 finished 14th in the RoboCup@Home Open League in Bordeaux.

Walkie 4 listens, navigates and grasps. It has two 7 DOF arms with parallel grippers, a lift for torso travel, a 3D lidar for SLAM and two 2D lidars for obstacles, all on a holonomic base with four Ø152 omni wheels. It runs ROS 2 Jazzy on Ubuntu 24.04, with Nav2 and MoveIt 2.

A team of 41 people built it: the five teams (Navigation, AI, Mechanical Design, Integration, and Operations & Support), our leadership and three advisors. See the robot on the [Walkie 4 page](/projects/walkie-4).$md$,
	'competition', 'EIC Chula', 'published', '2026-07-08 09:00:00+07',
	null, null, null, array['RoboCup@Home', 'Incheon', 'Walkie 4'],
	(select id from projects where slug = 'walkie-4'), true,
	'2026-07-08 09:00:00+07', '2026-07-08 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000006', 'getting-a-robot-to-incheon', 'Getting a robot to Incheon',
	'How Operations & Support is getting Walkie 4 to RoboCup@Home 2026 in Incheon.',
	$md$Walkie 4 is going to RoboCup@Home 2026 in Incheon, Korea. Getting it there is the work of Operations & Support, the team behind our finance and sponsorship.

Jakrin Pattnirun looks after finance. Mekkhala Wunbamrung, Nelinya Thanasittisupharat and Rinrada Surapolchai work on sponsorship.

Want to back a team that ships? We are open to sponsorship, joint research and open source work. Start a conversation through the form on our [About page](/about#contact).$md$,
	'competition', 'Operations & Support', 'published', '2026-06-25 09:00:00+07',
	null, null, null, array['RoboCup@Home', 'Sponsorship', 'Walkie 4'],
	(select id from projects where slug = 'walkie-4'), false,
	'2026-06-25 09:00:00+07', '2026-06-25 09:00:00+07'
), (
	'e1c00004-0000-4000-8000-000000000007', 'walkie-4-build-log-3', 'Walkie 4 build log #3',
	'Arms, lift and base: notes from the Mechanical Design team.',
	$md$Notes from the Mechanical Design team on Walkie 4's hardware.

Each of the two 7 DOF arms is carbon fiber, driven by AK series actuators, and ends in a parallel gripper. A lift gives the torso its travel. The base runs four Ø152 omni wheels in direct drive, so it can move in any direction.$md$,
	'engineering', 'Mechanical Team', 'draft', null,
	null, null, null, array['Mechanical', 'Walkie 4'],
	(select id from projects where slug = 'walkie-4'), false,
	-- Drafts: last edited an hour and a day before seeding, as on the dashboard design.
	now() - interval '1 day', now() - interval '1 hour'
), (
	'e1c00004-0000-4000-8000-000000000008', 'open-house-recap', 'Open house recap',
	'Thanks to everyone who visited us at the open house.',
	$md$Thanks to everyone who visited us at the open house.

Missed it? You can still join. Tell us about you through the form on the [About page](/about#contact).$md$,
	'club-life', 'EIC Chula', 'draft', null,
	null, null, null, array['Joining'], null, false,
	now() - interval '2 days', now() - interval '1 day'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Publications (Projects page, "Papers")
-- ---------------------------------------------------------------------------
insert into publications (id, year, title, sort_order) values
	('e1c00005-0000-4000-8000-000000000001', 2023, 'Transformable Wheelchair–Exoskeleton Hybrid Robot for Assisting Human Locomotion', 0),
	('e1c00005-0000-4000-8000-000000000002', 2022, 'Affordable Pipetting Robot: Gripper Design for Automatic Changing of Micropipette and Liquid Volume Control', 1),
	('e1c00005-0000-4000-8000-000000000003', 2022, 'Macro-Mini Linear Actuator Using Electrorheological-Fluid Brake for Impedance Modulation in Physical Human–Robot Interaction', 2),
	('e1c00005-0000-4000-8000-000000000004', 2021, 'Design and Modeling of a Variable-Stiffness Spring Mechanism for Impedance Modulation in Physical Human–Robot Interaction', 3),
	('e1c00005-0000-4000-8000-000000000005', 2020, 'A Spring-Embedded Planetary-Geared Parallel Elastic Actuator', 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Achievements (About timeline). sort_order follows the admin list (newest
-- first) and orders entries within a year; 2008 is two entries on the timeline.
-- ---------------------------------------------------------------------------
insert into achievements (id, year, placement, competition, short_name, location, sort_order) values
	('e1c00006-0000-4000-8000-000000000001', 2026, '6th', 'RoboCup@Home', '@Home', 'Incheon, Korea', 0),
	('e1c00006-0000-4000-8000-000000000002', 2023, '14th', 'RoboCup@Home Open League', '@Home', 'Bordeaux, France', 1),
	('e1c00006-0000-4000-8000-000000000003', 2022, '2nd', 'RoboCup@Home', '@Home', 'Bangkok, Thailand', 2),
	('e1c00006-0000-4000-8000-000000000004', 2022, '3rd', 'PLC Competition', 'PLC', null, 3),
	('e1c00006-0000-4000-8000-000000000005', 2020, '2nd', 'MEA Hackathon', 'MEA Hack', null, 4),
	('e1c00006-0000-4000-8000-000000000006', 2017, '3rd', 'PLC Competition', 'PLC', null, 5),
	('e1c00006-0000-4000-8000-000000000007', 2015, '2nd', 'Motor Expo Automotive Innovation', 'Motor Expo', null, 6),
	('e1c00006-0000-4000-8000-000000000008', 2014, '2nd', 'PLC Competition', 'PLC', null, 7),
	('e1c00006-0000-4000-8000-000000000009', 2012, '1st', 'PLC Competition', 'PLC', null, 8),
	('e1c00006-0000-4000-8000-000000000010', 2010, '6th', 'RoboCup@Home', '@Home', null, 9),
	('e1c00006-0000-4000-8000-000000000011', 2008, '1st', 'RoboCup Soccer', 'Soccer', null, 10),
	('e1c00006-0000-4000-8000-000000000012', 2008, '1st', 'RoboCup Rescue', 'Rescue', null, 11),
	('e1c00006-0000-4000-8000-000000000013', 2007, '2nd', 'RoboCup Soccer', 'Soccer', null, 12),
	('e1c00006-0000-4000-8000-000000000014', 2006, '3rd', 'RoboCup Soccer', 'Soccer', null, 13)
on conflict do nothing;

-- Walkie 4 finished 6th of 24 teams in 2026.
update achievements set entrants = 24
where id = 'e1c00006-0000-4000-8000-000000000001' and entrants is null;

-- ---------------------------------------------------------------------------
-- Archive photos (About, "Pinned to the lab wall")
-- ---------------------------------------------------------------------------
insert into archive_photos (id, image_url, alt, caption, sort_order) values
	('e1c00007-0000-4000-8000-000000000001', '/images/archive/robocup-2008.jpg', 'The EIC team in yellow shirts with their robots and a Thai flag at RoboCup 2008', 'RoboCup 2008, 1st!', 0),
	('e1c00007-0000-4000-8000-000000000002', '/images/archive/plc-2022.webp', 'EIC members on stage receiving an award at the 2022 PLC Competition', 'PLC 2022, 3rd', 1),
	('e1c00007-0000-4000-8000-000000000003', '/images/archive/mea-2020.webp', 'EIC members on stage holding a prize board at the 2020 MEA Hackathon', 'MEA Hackathon 2020', 2),
	('e1c00007-0000-4000-8000-000000000004', '/images/archive/walkie2-crew.webp', 'Team members standing beside Walkie 2 in a competition arena', 'Walkie 2 and crew', 3),
	('e1c00007-0000-4000-8000-000000000005', '/images/archive/walkie2-table.webp', 'A robot arm working over a white table', 'Walkie 2 at work', 4),
	('e1c00007-0000-4000-8000-000000000006', '/images/archive/walkie2-arm.webp', 'A robot arm lining up a grasp on a water bottle', 'Grasp test', 5)
on conflict do nothing;

commit;
