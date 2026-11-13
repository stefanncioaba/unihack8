We are creating a mobile application for a hackathon that has this solvig this problem:
"Connected Communities
Rethink how people, businesses and communities interact with the places around them. Build
innovative digital solutions that connect people, services, infrastructure and data to make
cities and communities smarter, safer, more efficient and more sustainable."

RULES:
- Never commit co-authored
- Always create knowledge graphs and update them accordingly
- Always update DOCS.md when making a change
- Always make tests for the code
- Always ask when not sure about something
- Always check PLAN.md when needed
- I will give you the next task when you finish the current one from PLAN.md
- Add short comments where needed and before every function

OUR CORE IDEA:
We will make an application with this features :
- A map that the user will be able to filter by categories such as resturants, coffee shops, and more.
- The map will also have a place where users can see real-time data about stpt (public transportation) in Timisoara.
- The user will be able to get directions and a time estimate to reach their destination by walking, or by walking 
and public transportaion.
- We will have a feature where the users will be able to ask an AI questions like "Where can I eat a pizza near me
at a low price that actually have good reviews?", or "Where can I go out this weekend"
- On the map we will also have events like parties etc sourced from different platforms,
but users will also be able to add their own events to the map, which will be visible to other users.
Some events will have limited spots and other users will be able to participate. Given a QR code,
at the location the organiser will scan the QR code and they will get some reliability points for attending the
event. If the user does not attend the event, they will lose reliability points. 
The reliability points will be visible to other users and will help them decide whether to trust the participant 
or to ban him from participating the event.
- You will be able to see others profiles by searching for their username or by clicking on their profile from the event page. 
- The profile will show their reliability points, and events they have attended.
- Have info like "Last tram at this hour"

TECH STACK:
BACKEND : 
- Spring boot for building the APII and validating tokens
- Supabase for the database and authentifiication
- You will need to structure everything accordingly in the packages:
example:"users -> domain -> entity with file inside, dto with files inside ";
controller folder, mapper folder with mapper interface, and impl folder inside with the implementation written
by you, repository, and service in the same manner with interface and impl folder.

FRONTEND : 
- React Native for building the mobile application
- Using expo go build the application and test it
        
