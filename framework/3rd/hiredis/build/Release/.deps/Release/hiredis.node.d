cmd_Release/hiredis.node := ln -f "Release/obj.target/hiredis.node" "Release/hiredis.node" 2>/dev/null || (rm -rf "Release/hiredis.node" && cp -af "Release/obj.target/hiredis.node" "Release/hiredis.node")
