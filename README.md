webrtc
======

webrtc demo


workflow
------


  A                  server                B

        - register ->

        <- ok -
                             <- register -

                              - ok ->

       - call ->   create session/find B     

                              - call ->

                               <- accept -

        <- accept -

       - offer ->
                               - offer ->
        - candidate ->
                               - candidate ->
                               <- answer -
        <- answer -
                               <- candidate -
        <- candidate -






reference::
------

    http://w3c.github.io/webrtc-pc/#simple-peer-to-peer-example
    
    https://bitbucket.org/webrtc/codelab
    
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    
    
